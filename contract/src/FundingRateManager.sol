// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IFundingRateManager} from "./interfaces/IFundingRateManager.sol";

/// @title FundingRateManager
/// @notice Implements the perpetuals funding rate mechanism.
///
///         Formula:
///           fundingRate = k × (markPrice − indexPrice) / indexPrice
///
///         k = 1e13 (≈ 0.001% per 1% deviation per hour)
///
///         Positive fundingRate → longs pay shorts
///         Negative fundingRate → shorts pay longs
///
///         Funding is accumulated into separate cumulative indices for longs
///         and shorts. When a position is settled the delta of the index is
///         used to compute the funding owed.
contract FundingRateManager is IFundingRateManager, AccessControl {
    // ─── Roles ────────────────────────────────────────────────────────────
    bytes32 public constant HOOK_ROLE = keccak256("HOOK_ROLE");

    // ─── Constants ────────────────────────────────────────────────────────
    uint256 public constant FUNDING_INTERVAL = 1 hours;

    /// @dev k coefficient scaled by 1e18 to preserve precision
    ///      k = 0.0001 per 1% deviation → 1e13 at 1e18 scale
    int256 public constant K = 1e13;

    uint256 public constant PRECISION = 1e18;

    // ─── State ────────────────────────────────────────────────────────────

    /// @notice Cumulative funding index for long positions.
    ///         Represents total funding paid per unit of size since inception.
    ///         Increases when longs pay shorts (positive funding).
    uint256 public override longCumulativeIndex;

    /// @notice Cumulative funding index for short positions.
    ///         Increases when shorts pay longs (negative funding).
    uint256 public override shortCumulativeIndex;

    uint256 public override lastFundingTime;
    int256 public override currentFundingRate;
    uint256 public fundingEpoch;

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        lastFundingTime = block.timestamp;
        // Start both indices at PRECISION to allow signed deltas
        longCumulativeIndex = PRECISION;
        shortCumulativeIndex = PRECISION;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier onlyHook() {
        if (!hasRole(HOOK_ROLE, msg.sender)) revert FundingRateManager__NotHook();
        _;
    }

    // ─── Write ────────────────────────────────────────────────────────────

    /// @inheritdoc IFundingRateManager
    function updateFunding(
        uint256 markPrice,
        uint256 indexPrice
    ) external override onlyHook {
        if (block.timestamp < lastFundingTime + FUNDING_INTERVAL) {
            revert FundingRateManager__TooEarlyToUpdate();
        }

        // Calculate how many full intervals have elapsed
        uint256 elapsed = block.timestamp - lastFundingTime;
        uint256 intervals = elapsed / FUNDING_INTERVAL;

        // fundingRate = K * (markPrice - indexPrice) / indexPrice
        int256 priceDelta = int256(markPrice) - int256(indexPrice);
        int256 rate = (K * priceDelta) / int256(indexPrice);
        currentFundingRate = rate;

        // Apply funding for each elapsed interval
        // Each interval: index += rate (rate can be negative)
        // We multiply by intervals to batch-apply missed epochs
        if (rate > 0) {
            // Longs pay shorts
            uint256 longPayment = uint256(rate * int256(intervals));
            longCumulativeIndex += longPayment;
        } else if (rate < 0) {
            // Shorts pay longs
            uint256 shortPayment = uint256((-rate) * int256(intervals));
            shortCumulativeIndex += shortPayment;
        }

        lastFundingTime += intervals * FUNDING_INTERVAL;
        unchecked {
            fundingEpoch += intervals;
        }

        emit FundingUpdated(
            fundingEpoch,
            rate,
            longCumulativeIndex,
            shortCumulativeIndex,
            block.timestamp
        );
    }

    // ─── View ─────────────────────────────────────────────────────────────

    /// @inheritdoc IFundingRateManager
    /// @dev fundingOwed > 0 → trader must pay; < 0 → trader receives
    function getFundingOwed(
        bool isLong,
        uint256 size,
        uint256 lastFundingIndex
    ) external view override returns (int256 fundingOwed) {
        if (isLong) {
            // Delta of long cumulative index since position opened
            uint256 currentIdx = longCumulativeIndex;
            if (currentIdx >= lastFundingIndex) {
                uint256 delta = currentIdx - lastFundingIndex;
                // fundingOwed = size * delta / PRECISION
                fundingOwed = int256((size * delta) / PRECISION);
            } else {
                // Index decreased (shouldn't happen with longs paying, but defensive)
                uint256 delta = lastFundingIndex - currentIdx;
                fundingOwed = -int256((size * delta) / PRECISION);
            }
        } else {
            // Delta of short cumulative index since position opened
            uint256 currentIdx = shortCumulativeIndex;
            if (currentIdx >= lastFundingIndex) {
                uint256 delta = currentIdx - lastFundingIndex;
                fundingOwed = int256((size * delta) / PRECISION);
            } else {
                uint256 delta = lastFundingIndex - currentIdx;
                fundingOwed = -int256((size * delta) / PRECISION);
            }
        }
    }
}
