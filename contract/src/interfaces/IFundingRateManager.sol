// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IFundingRateManager {
    // ─── Errors ───────────────────────────────────────────────────────────
    error FundingRateManager__TooEarlyToUpdate();
    error FundingRateManager__NotHook();

    // ─── Events ───────────────────────────────────────────────────────────
    event FundingUpdated(
        uint256 indexed epoch,
        int256 fundingRate,
        uint256 longCumulativeIndex,
        uint256 shortCumulativeIndex,
        uint256 timestamp
    );

    // ─── Functions ────────────────────────────────────────────────────────

    /// @notice Update funding rate using mark and index prices.
    ///         Can only be called once per FUNDING_INTERVAL.
    /// @param markPrice  Current mark price (18 decimals)
    /// @param indexPrice Current index price (18 decimals)
    function updateFunding(uint256 markPrice, uint256 indexPrice) external;

    /// @notice Calculate the net funding owed by a position since lastFundingIndex.
    /// @param isLong             Whether the position is long
    /// @param size               Position size in USDC token units (6 decimals)
    /// @param lastFundingIndex   The cumulative index recorded when position was last settled
    /// @return fundingOwed       Amount owed (positive = trader pays, negative = trader receives)
    function getFundingOwed(
        bool isLong,
        uint256 size,
        uint256 lastFundingIndex
    ) external view returns (int256 fundingOwed);

    /// @notice Returns the current cumulative funding index for longs.
    function longCumulativeIndex() external view returns (uint256);

    /// @notice Returns the current cumulative funding index for shorts.
    function shortCumulativeIndex() external view returns (uint256);

    /// @notice Returns the timestamp of the last funding update.
    function lastFundingTime() external view returns (uint256);

    /// @notice Returns the current funding rate (scaled by 1e18).
    function currentFundingRate() external view returns (int256);
}
