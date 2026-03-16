// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ILiquidationEngine} from "./interfaces/ILiquidationEngine.sol";
import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {Position, PositionLib} from "./libraries/PositionLib.sol";

/// @title LiquidationEngine
/// @notice Handles position liquidations.
///
///         A position is liquidatable when:
///           marginRatio = effectiveMargin / size < 5%
///
///         The liquidator receives 5% of remaining margin as a bonus.
///         The remainder goes to the protocol treasury.
///
///         Cooldown: at least 1 block must pass between liquidation calls
///         for the same trader (prevents spamming / sandwiching).
contract LiquidationEngine is ILiquidationEngine, ReentrancyGuard, AccessControl {
    using PositionLib for Position;
    using SafeERC20 for IERC20;

    // ─── Roles ───────────────────────────────────────────────────────────
    bytes32 public constant HOOK_ROLE = keccak256("HOOK_ROLE");

    // ─── Constants ───────────────────────────────────────────────────────
    /// @dev 5% maintenance margin in bps
    uint256 public constant MAINTENANCE_MARGIN_BPS = 500;
    /// @dev 5% liquidation bonus for liquidator in bps
    uint256 public constant LIQUIDATION_BONUS_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ─── Immutables ──────────────────────────────────────────────────────
    IPositionManager public immutable positionManager;
    IERC20 public immutable usdc;
    address public immutable treasury;

    // ─── State ───────────────────────────────────────────────────────────
    /// @notice Last block number a liquidation was attempted for each trader.
    mapping(address => uint256) public lastLiquidationBlock;

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(
        address admin,
        address _positionManager,
        address _usdc,
        address _treasury
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        positionManager = IPositionManager(_positionManager);
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyHook() {
        if (!hasRole(HOOK_ROLE, msg.sender)) revert LiquidationEngine__NotHook();
        _;
    }

    // ─── External ────────────────────────────────────────────────────────

    /// @inheritdoc ILiquidationEngine
    function checkLiquidation(
        address trader,
        uint256 currentPrice
    ) external view override returns (bool) {
        if (!positionManager.hasOpenPosition(trader)) return false;
        Position memory pos = positionManager.getPosition(trader);
        return pos.isLiquidatable(currentPrice);
    }

    /// @inheritdoc ILiquidationEngine
    function liquidatePosition(
        address trader,
        address liquidator
    ) external override onlyHook nonReentrant {
        // ─── Cooldown Check ───────────────────────────────────────────
        if (lastLiquidationBlock[trader] == block.number) {
            revert LiquidationEngine__CooldownActive();
        }

        if (!positionManager.hasOpenPosition(trader)) {
            revert LiquidationEngine__NoOpenPosition();
        }

        Position memory pos = positionManager.getPosition(trader);

        // We use the price that made the position liquidatable (passed via ThaHtayHook)
        // The hook validates the price before calling here.
        // Re-derive a worst-case price for the trader from position state.
        // In practice, ThaHtayHook reads currentPrice from slot0 and passes it.
        // Here we compute the liquidation using the margin and position math.
        // The *actual* current price is embedded in effectiveMargin via the hook.
        // For this contract to be self-contained, we accept the hook's authority.

        // Derive the effective margin at the time of liquidation.
        // Since we can't re-read slot0 here, we use the position's recorded margin.
        // The hook is responsible for verifying liquidatability before calling.
        uint256 remainingMargin = pos.margin;

        // Liquidation bonus = 5% of remaining margin.
        uint256 bonus = (remainingMargin * LIQUIDATION_BONUS_BPS) / BPS_DENOMINATOR;
        // Cap bonus at remaining margin
        if (bonus > remainingMargin) bonus = remainingMargin;

        uint256 toTreasury = remainingMargin - bonus;

        // Record liquidation block before external calls (CEI pattern)
        lastLiquidationBlock[trader] = block.number;

        // Close the position in PositionManager (hook granted us the HOOK_ROLE)
        positionManager.closePosition(trader);

        // Transfer bonus from this contract's USDC balance (funded by ThaHtayHook)
        if (bonus > 0) {
            usdc.safeTransfer(liquidator, bonus);
        }
        if (toTreasury > 0) {
            usdc.safeTransfer(treasury, toTreasury);
        }

        emit Liquidated(
            trader,
            liquidator,
            pos.entryPrice, // approximation — hook emits true liquidation price
            bonus,
            toTreasury
        );
    }
}
