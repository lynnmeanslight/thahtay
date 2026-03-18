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

interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint publishTime;
    }

    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);
}

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

    /// @notice Free collateral balance (USDC, 6 decimals) held in protocol vault.
    mapping(address => uint256) public collateralBalance;

    /// @notice At-risk traders watched for liquidation (capped list for gas)
    address[] public watchlist;
    mapping(address => bool) private _onWatchlist;
    uint256 public constant WATCHLIST_MAX = 50;

    /// @notice External index price (same units as getSpotPrice), updated by keeper.
    uint256 public indexPrice;
    uint256 public indexPriceUpdatedAt;
    uint256 public constant INDEX_PRICE_MAX_AGE = 15 minutes;

    /// @notice Optional Pyth oracle config for index price reference.
    address public pythOracle;
    bytes32 public pythPriceId;
    uint256 public pythMaxAge = 60;

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
    event CollateralDeposited(address indexed trader, uint256 amount);
    event CollateralWithdrawn(address indexed trader, uint256 amount);
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
    event IndexPriceUpdated(uint256 indexPrice, uint256 timestamp);
    event PythConfigUpdated(address oracle, bytes32 priceId, uint256 maxAge);
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
        indexPrice = initPrice;
        indexPriceUpdatedAt = block.timestamp;
        emit FundingUpdated(0, initPrice, initPrice);
        emit IndexPriceUpdated(initPrice, block.timestamp);
        return IHooks.afterInitialize.selector;
    }

    function _beforeSwap(
        address sender,
        PoolKey calldata,
        SwapParams calldata,
        bytes calldata
    ) internal view override returns (bytes4, BeforeSwapDelta, uint24) {
        require(hasRole(KEEPER_ROLE, sender), "ThaHtayHook: not keeper");
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

    /// @notice Deposit collateral into the protocol vault.
    /// @param amount USDC amount in token units (6 decimals)
    function depositCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "ThaHtayHook: amount=0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        collateralBalance[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Withdraw free collateral from protocol vault.
    /// @param amount USDC amount in token units (6 decimals)
    function withdrawCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "ThaHtayHook: amount=0");
        address trader = msg.sender;
        require(collateralBalance[trader] >= amount, "ThaHtayHook: insufficient collateral");

        collateralBalance[trader] -= amount;
        usdc.safeTransfer(trader, amount);
        emit CollateralWithdrawn(trader, amount);
    }

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

        // Consume internal collateral balance; pull top-up only if needed.
        uint256 freeBal = collateralBalance[trader];
        if (freeBal < totalRequired) {
            uint256 deficit = totalRequired - freeBal;
            usdc.safeTransferFrom(trader, address(this), deficit);
            freeBal += deficit;
        }
        collateralBalance[trader] = freeBal - totalRequired;

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

        // Settle to free collateral balance; user withdraws via withdrawCollateral().
        int256 totalReturn = int256(pos.margin) + netPnl;
        if (totalReturn > 0) {
            collateralBalance[trader] += uint256(totalReturn);
        }
        // If totalReturn <= 0, margin is consumed by losses — no credit

        uint256 fundingPaidAbs = fundingOwed > 0 ? uint256(fundingOwed) : 0;
        emit PositionClosed(trader, exitPrice, netPnl, fundingPaidAbs);
    }

    /// @notice Deposit additional margin into an open position.
    /// @param amount USDC amount in token units (6 decimals)
    function addMargin(uint256 amount) external nonReentrant {
        require(amount > 0, "ThaHtayHook: amount=0");
        address trader = msg.sender;
        require(positionManager.hasOpenPosition(trader), "ThaHtayHook: no position");

        // Consume internal collateral balance; pull top-up only if needed.
        uint256 freeBal = collateralBalance[trader];
        if (freeBal < amount) {
            uint256 deficit = amount - freeBal;
            usdc.safeTransferFrom(trader, address(this), deficit);
            freeBal += deficit;
        }
        collateralBalance[trader] = freeBal - amount;

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
        
        int256 fundingOwed = fundingRateManager.getFundingOwed(
            pos.isLong,
            pos.size,
            pos.lastFundingIndex
        );

        int256 nominalNewMargin = int256(newMargin) - fundingOwed;
        require(nominalNewMargin > 0, "ThaHtayHook: under margin");
        
        Position memory simulated = pos;
        simulated.margin = uint256(nominalNewMargin);
        require(!simulated.isLiquidatable(currentPrice), "ThaHtayHook: below maintenance");

        positionManager.removeMargin(trader, amount);
        collateralBalance[trader] += amount;

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
        uint256 margin = pos.margin;

        // we do not call positionManager.closePosition here because
        // LiquidationEngine does it. Just remove from watchlist.
        _removeFromWatchlist(trader);

        // Send margin to LiquidationEngine — it handles bonus + treasury split + closePosition
        usdc.safeTransfer(address(liquidationEngine), margin);

        // Execute liquidation (LiquidationEngine will send bonus to msg.sender)
        liquidationEngine.liquidatePosition(trader, msg.sender);

        // The liquidation engine emits its own event, but we can emit ours if we want or just remove it
        // Or we just don't emit our own to avoid double events, but the interface might expect it
        // Actually, LiquidationEngine emits Liquidated. We don't need a duplicate.
    }

    /// @notice Manually trigger funding update. Anyone can call.
    function triggerFundingUpdate() external {
        uint256 currentPrice = _getSpotPrice(poolKey);
        _tryUpdateFunding(currentPrice);
    }

    /// @notice Update external index price used by funding calculation.
    /// @dev Price must use same units/orientation as getSpotPrice().
    function setIndexPrice(uint256 newIndexPrice) external onlyRole(KEEPER_ROLE) {
        require(newIndexPrice > 0, "ThaHtayHook: bad index price");
        indexPrice = newIndexPrice;
        indexPriceUpdatedAt = block.timestamp;
        emit IndexPriceUpdated(newIndexPrice, block.timestamp);
    }

    /// @notice Configure Pyth oracle source for funding index reference.
    /// @dev If configured and fresh, Pyth price is preferred over keeper-fed indexPrice.
    function setPythConfig(address oracle, bytes32 priceId, uint256 maxAge) external onlyRole(ADMIN_ROLE) {
        require(maxAge > 0 && maxAge <= 1 days, "ThaHtayHook: bad pyth age");
        pythOracle = oracle;
        pythPriceId = priceId;
        pythMaxAge = maxAge;
        emit PythConfigUpdated(oracle, priceId, maxAge);
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

        (uint256 resolvedIndexPrice, bool ok) = _resolveIndexPrice(currentPrice);
        if (!ok) return;

        try fundingRateManager.updateFunding(currentPrice, resolvedIndexPrice) {
            emit FundingUpdated(
                fundingRateManager.currentFundingRate(),
                fundingRateManager.longCumulativeIndex(),
                fundingRateManager.shortCumulativeIndex()
            );
        } catch {}
    }

    function _resolveIndexPrice(uint256 currentPrice) internal view returns (uint256 resolved, bool ok) {
        // Prefer Pyth when configured and fresh.
        (uint256 pythIndex, bool pythOk) = _getPythIndexPrice();
        if (pythOk) {
            return (pythIndex, true);
        }

        // Fallback: keeper-fed index price.
        if (indexPrice > 0 && block.timestamp <= indexPriceUpdatedAt + INDEX_PRICE_MAX_AGE) {
            return (indexPrice, true);
        }

        // Last resort: use current mark to avoid reverts (no-op funding differential).
        if (currentPrice > 0) {
            return (currentPrice, true);
        }
        return (0, false);
    }

    function _getPythIndexPrice() internal view returns (uint256, bool) {
        if (pythOracle == address(0) || pythPriceId == bytes32(0)) return (0, false);

        try IPyth(pythOracle).getPriceNoOlderThan(pythPriceId, pythMaxAge) returns (IPyth.Price memory p) {
            if (p.price <= 0) return (0, false);

            uint256 ethUsdE18 = _scalePriceTo1e18(uint64(p.price), p.expo);
            if (ethUsdE18 == 0) return (0, false);

            // Match current protocol spot-price orientation used across keeper/frontend.
            // protocolPrice ~= 1e18 / ethUsd
            return ((1e36) / ethUsdE18, true);
        } catch {
            return (0, false);
        }
    }

    function _scalePriceTo1e18(uint256 rawPrice, int32 expo) internal pure returns (uint256) {
        if (expo >= 0) {
            uint32 pos = uint32(expo);
            if (pos > 18) return 0;
            return rawPrice * (10 ** pos) * 1e18;
        }

        uint32 neg = uint32(-expo);
        if (neg > 77) return 0;
        uint256 denom = 10 ** neg;
        return (rawPrice * 1e18) / denom;
    }

    function _scanLiquidations(uint256 currentPrice) internal {
        uint256 len = watchlist.length;
        if (len == 0) return;
        // Scan up to 5 positions per swap (gas limit safety)
        uint256 limit = len < 5 ? len : 5;
        uint256 i = 0;
        uint256 iterations = 0;

        while (i < watchlist.length && iterations < limit) {
            address trader = watchlist[i];
            if (
                positionManager.hasOpenPosition(trader) &&
                liquidationEngine.checkLiquidation(trader, currentPrice)
            ) {
                // Auto-liquidate: bonus goes to block.coinbase (validator) for MEV alignment
                Position memory pos = positionManager.getPosition(trader);
                uint256 margin = pos.margin;

                _removeFromWatchlist(trader);

                usdc.safeTransfer(address(liquidationEngine), margin);
                try liquidationEngine.liquidatePosition(trader, block.coinbase) {
                    // Success, handled by liquidation engine
                } catch {
                    // If it reverts (e.g., cooldown), we swallow the error so we don't block the swap.
                    // The trader is already removed from the watchlist for this block,
                    // but they still have an open position. A keeper can manually liquidate them.
                }
            } else {
                unchecked { ++i; }
            }
            unchecked { ++iterations; }
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
