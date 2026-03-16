// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Stored position for a single trader
struct Position {
    address trader;
    bool isLong;
    uint256 size;            // Notional size in USDC token units (6 decimals)
    uint256 margin;          // Deposited margin in USDC token units (6 decimals)
    uint256 entryPrice;      // Price at open (18 decimals)
    uint256 leverage;        // e.g. 5 = 5x (no decimals)
    uint256 lastFundingIndex; // Cumulative funding index at last settlement
    uint256 openedAt;        // Block timestamp when position was opened
}

/// @title PositionLib
/// @notice Pure math functions for position accounting
library PositionLib {
    uint256 internal constant PRECISION = 1e18;

    // 5% maintenance margin in basis points
    uint256 internal constant MAINTENANCE_MARGIN_BPS = 500;
    uint256 internal constant BPS_DENOMINATOR = 10_000;

    // Maximum leverage: 10x
    uint256 internal constant MAX_LEVERAGE = 10;
    uint256 internal constant MIN_LEVERAGE = 1;

    /// @notice Calculate unrealized PnL for a position
    /// @param pos           The open position
    /// @param currentPrice  Current mark price (18 decimals)
    /// @return pnl          Signed PnL in USDC token units; positive = profit
    function unrealizedPnl(
        Position memory pos,
        uint256 currentPrice
    ) internal pure returns (int256 pnl) {
        if (pos.size == 0) return 0;

        if (pos.isLong) {
            // Long PnL = size * (currentPrice - entryPrice) / entryPrice
            if (currentPrice >= pos.entryPrice) {
                uint256 gain = (pos.size * (currentPrice - pos.entryPrice)) / pos.entryPrice;
                pnl = int256(gain);
            } else {
                uint256 loss = (pos.size * (pos.entryPrice - currentPrice)) / pos.entryPrice;
                pnl = -int256(loss);
            }
        } else {
            // Short PnL = size * (entryPrice - currentPrice) / entryPrice
            if (pos.entryPrice >= currentPrice) {
                uint256 gain = (pos.size * (pos.entryPrice - currentPrice)) / pos.entryPrice;
                pnl = int256(gain);
            } else {
                uint256 loss = (pos.size * (currentPrice - pos.entryPrice)) / pos.entryPrice;
                pnl = -int256(loss);
            }
        }
    }

    /// @notice Calculate effective margin = margin + unrealizedPnl
    /// @return effectiveMargin  Can be negative (insolvent)
    function effectiveMargin(
        Position memory pos,
        uint256 currentPrice
    ) internal pure returns (int256) {
        int256 pnl = unrealizedPnl(pos, currentPrice);
        return int256(pos.margin) + pnl;
    }

    /// @notice Returns the margin ratio as a fraction of notional (scaled by 1e18)
    ///         marginRatio = effectiveMargin / size
    function marginRatio(
        Position memory pos,
        uint256 currentPrice
    ) internal pure returns (int256 ratio) {
        if (pos.size == 0) return type(int256).max;
        int256 em = effectiveMargin(pos, currentPrice);
        ratio = (em * int256(PRECISION)) / int256(pos.size);
    }

    /// @notice Returns true if position should be liquidated
    function isLiquidatable(
        Position memory pos,
        uint256 currentPrice
    ) internal pure returns (bool) {
        int256 ratio = marginRatio(pos, currentPrice);
        // maintenanceMargin = 5% = 500/10000 scaled to 1e18 = 5e16
        int256 maintenanceThreshold = int256((MAINTENANCE_MARGIN_BPS * PRECISION) / BPS_DENOMINATOR);
        return ratio < maintenanceThreshold;
    }

    /// @notice Calculate the liquidation price for a position
    /// @dev For long:  liqPrice = entryPrice * (1 - (margin/size - maintenanceMargin%))
    ///      For short: liqPrice = entryPrice * (1 + (margin/size - maintenanceMargin%))
    function liquidationPrice(Position memory pos) internal pure returns (uint256 liqPrice) {
        if (pos.size == 0) return 0;

        // maintenanceMarginRatio = 5% = 0.05
        // marginRatioAtOpen = margin / size
        // buffer = marginRatioAtOpen - maintenanceMarginRatio
        // For long:  liqPrice = entryPrice * (1 - buffer)
        // For short: liqPrice = entryPrice * (1 + buffer)

        uint256 maintenancePrecision = (MAINTENANCE_MARGIN_BPS * PRECISION) / BPS_DENOMINATOR; // 5e16
        uint256 marginRatioAtOpen = (pos.margin * PRECISION) / pos.size;

        if (pos.isLong) {
            if (marginRatioAtOpen <= maintenancePrecision) {
                // Already at or below maintenance — would be immediately liquidatable
                return pos.entryPrice;
            }
            uint256 buffer = marginRatioAtOpen - maintenancePrecision;
            liqPrice = pos.entryPrice - (pos.entryPrice * buffer) / PRECISION;
        } else {
            uint256 buffer = marginRatioAtOpen + maintenancePrecision;
            // Cap at 2x entry to avoid overflow
            if (buffer >= PRECISION) {
                return type(uint256).max;
            }
            liqPrice = pos.entryPrice + (pos.entryPrice * buffer) / PRECISION;
        }
    }

    /// @notice Validate leverage is within allowed range [1, 10]
    function validateLeverage(uint256 leverage) internal pure returns (bool) {
        return leverage >= MIN_LEVERAGE && leverage <= MAX_LEVERAGE;
    }
}
