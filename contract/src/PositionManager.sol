// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {Position, PositionLib} from "./libraries/PositionLib.sol";

/// @title PositionManager
/// @notice Stores and manages all trader positions.
///         Only the ThaHtayHook (granted HOOK_ROLE) can mutate state.
///         USDC transfers are routed through ThaHtayHook; this contract
///         tracks accounting but does NOT hold USDC directly.
contract PositionManager is IPositionManager, ReentrancyGuard, AccessControl {
    using PositionLib for Position;
    using SafeERC20 for IERC20;

    // ─── Roles ────────────────────────────────────────────────────────────
    bytes32 public constant HOOK_ROLE = keccak256("HOOK_ROLE");

    // ─── State ────────────────────────────────────────────────────────────
    mapping(address => Position) private _positions;
    mapping(address => bool) private _hasPosition;

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── Modifiers ────────────────────────────────────────────────────────
    modifier onlyHook() {
        if (!hasRole(HOOK_ROLE, msg.sender)) revert PositionManager__NotHook();
        _;
    }

    // ─── Write Functions ──────────────────────────────────────────────────

    /// @inheritdoc IPositionManager
    function openPosition(
        address trader,
        bool isLong,
        uint256 size,
        uint256 margin,
        uint256 entryPrice,
        uint256 leverage,
        uint256 fundingIndex
    ) external override onlyHook nonReentrant {
        if (_hasPosition[trader]) revert PositionManager__PositionAlreadyOpen();
        if (!PositionLib.validateLeverage(leverage)) revert PositionManager__InvalidLeverage();
        if (size == 0) revert PositionManager__InvalidSize();
        if (margin == 0) revert PositionManager__InsufficientMargin();

        _positions[trader] = Position({
            trader: trader,
            isLong: isLong,
            size: size,
            margin: margin,
            entryPrice: entryPrice,
            leverage: leverage,
            lastFundingIndex: fundingIndex,
            openedAt: block.timestamp
        });
        _hasPosition[trader] = true;

        emit PositionOpened(trader, isLong, size, margin, entryPrice, leverage);
    }

    /// @inheritdoc IPositionManager
    function closePosition(
        address trader
    ) external override onlyHook nonReentrant returns (Position memory pos) {
        if (!_hasPosition[trader]) revert PositionManager__NoOpenPosition();

        pos = _positions[trader];
        delete _positions[trader];
        _hasPosition[trader] = false;

        // PnL is calculated and settled by ThaHtayHook; emit with 0 here
        // (hook emits PositionClosed with actual realizedPnl)
        emit PositionClosed(trader, 0, 0);
    }

    /// @inheritdoc IPositionManager
    function addMargin(
        address trader,
        uint256 amount
    ) external override onlyHook nonReentrant {
        if (!_hasPosition[trader]) revert PositionManager__NoOpenPosition();
        _positions[trader].margin += amount;
        emit MarginAdded(trader, amount);
    }

    /// @inheritdoc IPositionManager
    function removeMargin(
        address trader,
        uint256 amount
    ) external override onlyHook nonReentrant returns (uint256 newMargin) {
        if (!_hasPosition[trader]) revert PositionManager__NoOpenPosition();
        Position storage pos = _positions[trader];
        if (amount > pos.margin) revert PositionManager__InsufficientMargin();
        pos.margin -= amount;
        newMargin = pos.margin;
        emit MarginRemoved(trader, amount);
    }

    /// @inheritdoc IPositionManager
    function updateFundingIndex(
        address trader,
        uint256 newIndex
    ) external override onlyHook {
        if (!_hasPosition[trader]) revert PositionManager__NoOpenPosition();
        _positions[trader].lastFundingIndex = newIndex;
    }

    // ─── View Functions ───────────────────────────────────────────────────

    /// @inheritdoc IPositionManager
    function getPosition(address trader) external view override returns (Position memory) {
        return _positions[trader];
    }

    /// @inheritdoc IPositionManager
    function hasOpenPosition(address trader) external view override returns (bool) {
        return _hasPosition[trader];
    }
}
