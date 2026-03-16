// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPositionManager} from "./interfaces/IPositionManager.sol";
import {IFundingRateManager} from "./interfaces/IFundingRateManager.sol";
import {ILiquidationEngine} from "./interfaces/ILiquidationEngine.sol";
import {Position, PositionLib} from "./libraries/PositionLib.sol";
import {PriceLib} from "./libraries/PriceLib.sol";

/// @title ThaHtayHook
/// @notice Uniswap v4 Hook that powers ThaHtayHook perpetual futures.
///
///         This hook intercepts key pool lifecycle events to:
///           1. Track perp positions for traders
///           2. Update funding rates from pool price
///           3. Trigger liquidations for underwater positions
///
///         Traders interact with this contract directly (not via the pool swap).
///         The Uniswap v4 pool is used exclusively for price discovery.
///
/// @dev Hook address MUST be mined so that the lower bits match the enabled
///      hook flags below. Use HookMiner in the deploy script.
contract ThaHtayHook is BaseHook, ReentrancyGuard, AccessControl {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using PositionLib for Position;
    using SafeERC20 for IERC20;

    // ─── Roles ────────────────────────────────────────────────────────────
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    // ─── Constants ────────────────────────────────────────────────────────
    /// @dev Trading fee: 10 bps (0.1%)
    uint256 public constant TRADING_FEE_BPS = 10;
    /// @dev Referral share of trading fee: 20%
    uint256 public constant REFERRAL_FEE_BPS = 2000; // 20% of protocol fee
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // WETH=18 decimals, USDC=6 decimals
    uint8 public constant TOKEN0_DECIMALS = 18; // WETH
    uint8 public constant TOKEN1_DECIMALS = 6;  // USDC

    // ─── Immutables ───────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    IPositionManager public immutable positionManager;
    IFundingRateManager public immutable fundingRateManager;
    ILiquidationEngine public immutable liquidationEngine;
    address public immutable treasury;

    // ─── State ────────────────────────────────────────────────────────────

    /// @notice Active pool key this hook manages
    PoolKey public poolKey;

    /// @notice Referral mappings: trader → referrer
    mapping(address => address) public referrals;

    /// @notice Accumulated protocol fees (USDC, 6 decimals)
    uint256 public protocolFees;

    /// @notice At-risk traders watched for liquidation (capped list for gas)
    address[] public watchlist;
    mapping(address => bool) private _onWatchlist;
    uint256 public constant WATCHLIST_MAX = 50;

    // ─── Events ───────────────────────────────────────────────────────────
    event PositionOpened(
        address indexed trader,
        bool indexed isLong,
        uint256 size,
        uint256 margin,
        uint256 entryPrice,
        uint256 leverage,
        uint256 liquidationPrice,
        address referrer
    );
    event PositionClosed(
        address indexed trader,
        uint256 exitPrice,
        int256 realizedPnl,
        uint256 fundingPaid
    );
    event MarginAdded(address indexed trader, uint256 amount);
    event MarginRemoved(address indexed trader, uint256 amount);
    event Liquidated(
        address indexed trader,
        address indexed liquidator,
        uint256 liquidationPrice,
        uint256 bonus
    );
    event FundingUpdated(
        int256 fundingRate,
        uint256 longCumulativeIndex,
        uint256 shortCumulativeIndex
    );
    event ReferralSet(address indexed trader, address indexed referrer);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(
        IPoolManager _poolManager,
        address _usdc,
        address _positionManager,
        address _fundingRateManager,
        address _liquidationEngine,
        address _treasury,
        address _admin
    ) BaseHook(_poolManager) {
        usdc = IERC20(_usdc);
        positionManager = IPositionManager(_positionManager);
        fundingRateManager = IFundingRateManager(_fundingRateManager);
        liquidationEngine = ILiquidationEngine(_liquidationEngine);
        treasury = _treasury;

        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(KEEPER_ROLE, _admin);
    }

    // ─── Hook Permissions ─────────────────────────────────────────────────
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ─── Hook Callbacks ───────────────────────────────────────────────────

    function _beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) internal override returns (bytes4) {
        // Store the pool key for price reading
        poolKey = key;
        return IHooks.beforeInitialize.selector;
    }

    function _afterInitialize(
        address,
        PoolKey calldata,
        uint160 sqrtPriceX96,
        int24
    ) internal override returns (bytes4) {
        // Log the initial price for reference
        uint256 initPrice = PriceLib.sqrtPriceX96ToEthUsdcPrice(sqrtPriceX96);
        emit FundingUpdated(0, initPrice, initPrice);
        return IHooks.afterInitialize.selector;
    }

    function _beforeSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        bytes calldata
    ) internal pure override returns (bytes4, BeforeSwapDelta, uint24) {
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        // Read current price after every swap
        uint256 currentPrice = _getSpotPrice(key);

        // Attempt funding rate update (silently no-ops if not enough time has passed)
        _tryUpdateFunding(currentPrice);

        // Scan watchlist for liquidations (gas-bounded)
        _scanLiquidations(currentPrice);

        return (IHooks.afterSwap.selector, 0);
    }

    // ─── Trader-Facing Functions ───────────────────────────────────────────

    /// @notice Open a perpetual position. Margin must be approved before calling.
    /// @param isLong    True = long (buy), false = short (sell)
    /// @param size      Notional position size in USDC token units (6 decimals)
    /// @param leverage  Leverage multiplier (1–10)
    /// @param referrer  Optional referrer address (use address(0) for none)
    function openPosition(
        bool isLong,
        uint256 size,
        uint256 leverage,
        address referrer
    ) external nonReentrant {
        require(size > 0, "ThaHtayHook: size=0");
        require(PositionLib.validateLeverage(leverage), "ThaHtayHook: bad leverage");

        address trader = msg.sender;
        require(!positionManager.hasOpenPosition(trader), "ThaHtayHook: position open");

        // Required margin = size / leverage
        uint256 margin = size / leverage;
        require(margin > 0, "ThaHtayHook: margin=0");

        // Trading fee on notional size
        uint256 fee = (size * TRADING_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalRequired = margin + fee;

        // Pull USDC from trader (margin + fee)
        usdc.safeTransferFrom(trader, address(this), totalRequired);

        // Handle referral fee
        if (referrer != address(0) && referrer != trader) {
            if (referrals[trader] == address(0)) {
                referrals[trader] = referrer;
                emit ReferralSet(trader, referrer);
            }
            address effectiveReferrer = referrals[trader];
            uint256 referralFee = (fee * REFERRAL_FEE_BPS) / BPS_DENOMINATOR;
            fee -= referralFee;
            usdc.safeTransfer(effectiveReferrer, referralFee);
        }
        protocolFees += fee;

        // Fetch current price from pool
        uint256 entryPrice = _getSpotPrice(poolKey);
        require(entryPrice > 0, "ThaHtayHook: no price");

        // Get current funding index for the correct side
        uint256 fundingIndex = isLong
            ? fundingRateManager.longCumulativeIndex()
            : fundingRateManager.shortCumulativeIndex();

        // Store position
        positionManager.openPosition(
            trader,
            isLong,
            size,
            margin,
            entryPrice,
            leverage,
            fundingIndex
        );

        // Add to watchlist if not already there
        _addToWatchlist(trader);

        uint256 liqPrice = PositionLib.liquidationPrice(positionManager.getPosition(trader));

        emit PositionOpened(
            trader,
            isLong,
            size,
            margin,
            entryPrice,
            leverage,
            liqPrice,
            referrals[trader]
        );
    }

    /// @notice Close an open position and settle PnL.
    function closePosition() external nonReentrant {
        address trader = msg.sender;
        require(positionManager.hasOpenPosition(trader), "ThaHtayHook: no position");

        Position memory pos = positionManager.getPosition(trader);

        uint256 exitPrice = _getSpotPrice(poolKey);
        require(exitPrice > 0, "ThaHtayHook: no price");

        // Settle funding before closing
        int256 fundingOwed = fundingRateManager.getFundingOwed(
            pos.isLong,
            pos.size,
            pos.lastFundingIndex
        );

        // Calculate PnL
        int256 pnl = PositionLib.unrealizedPnl(pos, exitPrice);

        // Adjust for funding
        int256 netPnl = pnl - fundingOwed;

        // Remove position
        positionManager.closePosition(trader);
        _removeFromWatchlist(trader);

        // Settle USDC to trader
        int256 totalReturn = int256(pos.margin) + netPnl;
        if (totalReturn > 0) {
            uint256 returnAmount = uint256(totalReturn);
            // Cap at what the contract holds (solvency guard)
            uint256 available = usdc.balanceOf(address(this)) - protocolFees;
            if (returnAmount > available) returnAmount = available;
            usdc.safeTransfer(trader, returnAmount);
        }
        // If totalReturn <= 0, margin is consumed by losses — no transfer

        uint256 fundingPaidAbs = fundingOwed > 0 ? uint256(fundingOwed) : 0;
        emit PositionClosed(trader, exitPrice, netPnl, fundingPaidAbs);
    }

    /// @notice Deposit additional margin into an open position.
    /// @param amount USDC amount in token units (6 decimals)
    function addMargin(uint256 amount) external nonReentrant {
        require(amount > 0, "ThaHtayHook: amount=0");
        address trader = msg.sender;
        require(positionManager.hasOpenPosition(trader), "ThaHtayHook: no position");

        usdc.safeTransferFrom(trader, address(this), amount);
        positionManager.addMargin(trader, amount);

        emit MarginAdded(trader, amount);
    }

    /// @notice Withdraw excess margin (must remain above maintenance margin).
    /// @param amount Amount to withdraw in USDC internal units
    function removeMargin(uint256 amount) external nonReentrant {
        require(amount > 0, "ThaHtayHook: amount=0");
        address trader = msg.sender;
        require(positionManager.hasOpenPosition(trader), "ThaHtayHook: no position");

        Position memory pos = positionManager.getPosition(trader);
        uint256 newMargin = pos.margin - amount;

        // Ensure position remains above maintenance margin after removal
        uint256 currentPrice = _getSpotPrice(poolKey);
        Position memory simulated = pos;
        simulated.margin = newMargin;
        require(!simulated.isLiquidatable(currentPrice), "ThaHtayHook: below maintenance");

        positionManager.removeMargin(trader, amount);
        usdc.safeTransfer(trader, amount);

        emit MarginRemoved(trader, amount);
    }

    // ─── Keeper Functions ─────────────────────────────────────────────────

    /// @notice Force liquidate an at-risk position. Callable by anyone (permissionless).
    ///         Caller receives 5% of position value as bonus.
    function liquidate(address trader) external nonReentrant {
        uint256 currentPrice = _getSpotPrice(poolKey);
        require(
            liquidationEngine.checkLiquidation(trader, currentPrice),
            "ThaHtayHook: not liquidatable"
        );

        Position memory pos = positionManager.getPosition(trader);

        // Transfer position's margin to LiquidationEngine for distribution
        uint256 margin = pos.margin;
        // First close position to update state before fund transfer (CEI)
        positionManager.closePosition(trader);
        _removeFromWatchlist(trader);

        // Send margin to LiquidationEngine — it handles bonus + treasury split
        usdc.safeTransfer(address(liquidationEngine), margin);

        // Execute liquidation (LiquidationEngine will send bonus to msg.sender)
        // We re-open a "synthetic" position in LiquidationEngine context.
        // Since position is already closed, LiquidationEngine reads from its own state.
        // Instead, distribute here directly (matches LiquidationEngine logic):
        uint256 bonus = (margin * 500) / BPS_DENOMINATOR; // 5%
        if (bonus > margin) bonus = margin;
        uint256 toTreasury = margin - bonus;

        if (bonus > 0) {
            usdc.safeTransfer(msg.sender, bonus);
        }
        if (toTreasury > 0) {
            usdc.safeTransfer(treasury, toTreasury);
        }

        emit Liquidated(trader, msg.sender, currentPrice, bonus);
    }

    /// @notice Manually trigger funding update. Anyone can call.
    function triggerFundingUpdate() external {
        uint256 currentPrice = _getSpotPrice(poolKey);
        _tryUpdateFunding(currentPrice);
    }

    // ─── Admin Functions ──────────────────────────────────────────────────

    /// @notice Withdraw accumulated protocol fees to treasury.
    function withdrawFees() external onlyRole(ADMIN_ROLE) {
        uint256 amount = protocolFees;
        protocolFees = 0;
        usdc.safeTransfer(treasury, amount);
        emit FeesWithdrawn(treasury, amount);
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────

    function _getSpotPrice(PoolKey memory key) internal view returns (uint256) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        if (sqrtPriceX96 == 0) return 0;
        return PriceLib.sqrtPriceX96ToEthUsdcPrice(sqrtPriceX96);
    }

    function _tryUpdateFunding(uint256 currentPrice) internal {
        // Only update if an interval has passed (FundingRateManager reverts otherwise)
        if (block.timestamp < fundingRateManager.lastFundingTime() + 1 hours) return;
        try fundingRateManager.updateFunding(currentPrice, currentPrice) {
            emit FundingUpdated(
                fundingRateManager.currentFundingRate(),
                fundingRateManager.longCumulativeIndex(),
                fundingRateManager.shortCumulativeIndex()
            );
        } catch {}
    }

    function _scanLiquidations(uint256 currentPrice) internal {
        uint256 len = watchlist.length;
        if (len == 0) return;
        // Scan up to 5 positions per swap (gas limit safety)
        uint256 limit = len < 5 ? len : 5;
        for (uint256 i = 0; i < limit; ) {
            address trader = watchlist[i];
            if (
                positionManager.hasOpenPosition(trader) &&
                liquidationEngine.checkLiquidation(trader, currentPrice)
            ) {
                // Auto-liquidate: bonus goes to block.coinbase (validator) for MEV alignment
                Position memory pos = positionManager.getPosition(trader);
                uint256 margin = pos.margin;
                positionManager.closePosition(trader);
                _removeFromWatchlist(trader);

                uint256 bonus = (margin * 500) / BPS_DENOMINATOR;
                if (bonus > margin) bonus = margin;
                uint256 toTreasury = margin - bonus;

                if (bonus > 0) {
                    usdc.safeTransfer(block.coinbase, bonus);
                }
                if (toTreasury > 0) {
                    usdc.safeTransfer(treasury, toTreasury);
                }

                emit Liquidated(trader, block.coinbase, currentPrice, bonus);
            } else {
                unchecked { ++i; }
            }
        }
    }

    function _addToWatchlist(address trader) internal {
        if (_onWatchlist[trader]) return;
        if (watchlist.length >= WATCHLIST_MAX) return; // Skip if full — keeper handles manually
        watchlist.push(trader);
        _onWatchlist[trader] = true;
    }

    function _removeFromWatchlist(address trader) internal {
        if (!_onWatchlist[trader]) return;
        _onWatchlist[trader] = false;
        uint256 len = watchlist.length;
        for (uint256 i = 0; i < len; ) {
            if (watchlist[i] == trader) {
                watchlist[i] = watchlist[len - 1];
                watchlist.pop();
                return;
            }
            unchecked { ++i; }
        }
    }

    // ─── View Helpers ─────────────────────────────────────────────────────

    /// @notice Returns current spot price from the Uniswap v4 pool (18 decimals)
    function getSpotPrice() external view returns (uint256) {
        return _getSpotPrice(poolKey);
    }

    /// @notice Returns current watchlist
    function getWatchlist() external view returns (address[] memory) {
        return watchlist;
    }

    /// @notice Returns unrealized PnL for a trader at current price
    function getUnrealizedPnl(address trader) external view returns (int256) {
        if (!positionManager.hasOpenPosition(trader)) return 0;
        Position memory pos = positionManager.getPosition(trader);
        uint256 currentPrice = _getSpotPrice(poolKey);
        return PositionLib.unrealizedPnl(pos, currentPrice);
    }

    /// @notice Returns liquidation price for a trader
    function getLiquidationPrice(address trader) external view returns (uint256) {
        if (!positionManager.hasOpenPosition(trader)) return 0;
        return PositionLib.liquidationPrice(positionManager.getPosition(trader));
    }
}
