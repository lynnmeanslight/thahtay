// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ILiquidationEngine {
    // ─── Errors ───────────────────────────────────────────────────────────
    error LiquidationEngine__NotHook();
    error LiquidationEngine__PositionNotLiquidatable();
    error LiquidationEngine__NoOpenPosition();

    // ─── Events ───────────────────────────────────────────────────────────
    event Liquidated(
        address indexed trader,
        address indexed liquidator,
        uint256 liquidationPrice,
        uint256 liquidatorBonus,
        uint256 remainingMargin
    );

    // ─── Functions ────────────────────────────────────────────────────────

    /// @notice Returns true if the position is eligible for liquidation.
    /// @param trader        The trader's address
    /// @param currentPrice  Current mark price (18 decimals)
    function checkLiquidation(address trader, uint256 currentPrice) external view returns (bool);

    /// @notice Liquidates a position. Caller receives the liquidation bonus.
    /// @param trader     The trader whose position is liquidated
    /// @param liquidator The address that receives the bonus
    function liquidatePosition(address trader, address liquidator) external;
}
