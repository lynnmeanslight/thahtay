// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Position} from "../libraries/PositionLib.sol";

interface IPositionManager {
    // ─── Errors ───────────────────────────────────────────────────────────
    error PositionManager__NotHook();
    error PositionManager__PositionAlreadyOpen();
    error PositionManager__NoOpenPosition();
    error PositionManager__InsufficientMargin();
    error PositionManager__InvalidLeverage();
    error PositionManager__InvalidSize();

    // ─── Events ───────────────────────────────────────────────────────────
    event PositionOpened(
        address indexed trader,
        bool isLong,
        uint256 size,
        uint256 margin,
        uint256 entryPrice,
        uint256 leverage
    );
    event PositionClosed(
        address indexed trader,
        uint256 exitPrice,
        int256 realizedPnl
    );
    event MarginAdded(address indexed trader, uint256 amount);
    event MarginRemoved(address indexed trader, uint256 amount);

    // ─── Functions ────────────────────────────────────────────────────────
    function openPosition(
        address trader,
        bool isLong,
        uint256 size,
        uint256 margin,
        uint256 entryPrice,
        uint256 leverage,
        uint256 fundingIndex
    ) external;

    function closePosition(address trader) external returns (Position memory);

    function addMargin(address trader, uint256 amount) external;

    function removeMargin(address trader, uint256 amount) external returns (uint256 newMargin);

    function updateFundingIndex(address trader, uint256 newIndex) external;

    function getPosition(address trader) external view returns (Position memory);

    function hasOpenPosition(address trader) external view returns (bool);
}
