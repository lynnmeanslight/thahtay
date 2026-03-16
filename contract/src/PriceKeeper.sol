// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title PriceKeeper
/// @notice Executes targeted swaps on the Uniswap v4 pool to keep its slot0
///         price aligned with the real-world ETH/USDC price fetched off-chain.
///
/// How it works:
///   1. An off-chain keeper.js script fetches the live ETH price from Binance.
///   2. It computes the target sqrtPriceX96 and calls syncPrice().
///   3. This contract executes a v4 swap (via the unlock/callback pattern) that
///      pushes slot0 to the target — staying within the pool's own liquidity.
///   4. Because ThaHtayHook reads slot0 in afterSwap, the hook's funding rate
///      updates and liquidation scans are automatically driven by the real price.
///
/// sqrtPriceX96 formula (pool uses USDC=token0 6dec, WETH=token1 18dec):
///   sqrtPriceX96 = 2^96 / (sqrt(ethPriceUsd) * 1e6)
///   Increasing ETH price  → lower sqrtPriceX96 → zeroForOne = true  (buy WETH with USDC)
///   Decreasing ETH price  → higher sqrtPriceX96→ zeroForOne = false (sell WETH for USDC)
contract PriceKeeper is IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────

    /// @dev Minimum price drift to trigger a sync: 50 bps = 0.5%
    uint256 public constant THRESHOLD_BPS = 50;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ─── Immutables ───────────────────────────────────────────────────────

    IPoolManager public immutable poolManager;

    // ─── State ────────────────────────────────────────────────────────────

    PoolKey public poolKey;
    address public owner;

    // ─── Events ───────────────────────────────────────────────────────────

    event PriceSynced(
        uint160 indexed oldSqrtPriceX96,
        uint160 indexed newSqrtPriceX96,
        bool zeroForOne
    );

    // ─── Modifiers ────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "PriceKeeper: not owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────

    /// @param _poolManager   Uniswap v4 PoolManager address
    /// @param _token0        currency0 of the pool (lower address — USDC on Unichain)
    /// @param _token1        currency1 of the pool (higher address — WETH on Unichain)
    /// @param _fee           Pool fee tier (e.g. 3000 for 0.3%)
    /// @param _tickSpacing   Tick spacing matching the fee tier (60 for 0.3%)
    /// @param _hooks         Hook contract address (ThaHtayHook)
    constructor(
        address _poolManager,
        address _token0,
        address _token1,
        uint24  _fee,
        int24   _tickSpacing,
        address _hooks
    ) {
        poolManager = IPoolManager(_poolManager);
        poolKey = PoolKey({
            currency0: Currency.wrap(_token0),
            currency1: Currency.wrap(_token1),
            fee:         _fee,
            tickSpacing: _tickSpacing,
            hooks:       IHooks(_hooks)
        });
        owner = msg.sender;
    }

    // ─── External ─────────────────────────────────────────────────────────

    /// @notice Push the pool's sqrtPriceX96 toward `targetSqrtPriceX96`.
    /// @dev    Reverts if drift is below THRESHOLD_BPS. Only callable by owner.
    /// @param  targetSqrtPriceX96  Desired price, computed off-chain as:
    ///           floor(2^96 / (sqrt(ethPriceUsd) * 1e6))
    function syncPrice(uint160 targetSqrtPriceX96) external onlyOwner {
        (uint160 current,,,) = poolManager.getSlot0(poolKey.toId());
        require(current != 0, "PriceKeeper: pool not initialised");

        // Reject if drift is too small (saves gas on noisy updates)
        uint256 diff = current > targetSqrtPriceX96
            ? uint256(current) - uint256(targetSqrtPriceX96)
            : uint256(targetSqrtPriceX96) - uint256(current);
        require(
            diff * BPS_DENOMINATOR >= uint256(current) * THRESHOLD_BPS,
            "PriceKeeper: drift below threshold"
        );

        // Higher ETH price → lower sqrtPriceX96 → buy WETH (zeroForOne = true)
        bool zeroForOne = targetSqrtPriceX96 < current;

        // Pre-approve the PoolManager for whichever token we're selling
        address sellToken = zeroForOne
            ? Currency.unwrap(poolKey.currency0)   // sell USDC
            : Currency.unwrap(poolKey.currency1);  // sell WETH
        IERC20(sellToken).approve(address(poolManager), type(uint256).max);

        poolManager.unlock(abi.encode(current, zeroForOne, targetSqrtPriceX96));
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        require(msg.sender == address(poolManager), "PriceKeeper: not poolManager");

        (uint160 oldSqrt, bool zeroForOne, uint160 sqrtPriceLimitX96) =
            abi.decode(data, (uint160, bool, uint160));

        // amountSpecified < 0 → exactIn; swap is bounded by sqrtPriceLimitX96.
        // 1e30 is large enough for any testnet pool; the price limit stops it early.
        BalanceDelta delta = poolManager.swap(
            poolKey,
            SwapParams({
                zeroForOne:        zeroForOne,
                amountSpecified:   -int256(1e30),
                sqrtPriceLimitX96: sqrtPriceLimitX96
            }),
            bytes("")
        );

        _settle(poolKey.currency0, delta.amount0());
        _settle(poolKey.currency1, delta.amount1());

        (uint160 newSqrt,,,) = poolManager.getSlot0(poolKey.toId());
        emit PriceSynced(oldSqrt, newSqrt, zeroForOne);

        return "";
    }

    /// @notice Withdraw tokens accumulated in the contract back to owner.
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner, amount);
    }

    receive() external payable {}

    // ─── Internal ─────────────────────────────────────────────────────────

    /// @dev Settle a single currency delta after a swap.
    ///      delta < 0: we owe tokens → sync + transfer + settle
    ///      delta > 0: pool owes us  → take
    function _settle(Currency currency, int128 delta) internal {
        if (delta < 0) {
            uint256 owed = uint256(uint128(-delta));
            poolManager.sync(currency);
            currency.transfer(address(poolManager), owed);
            poolManager.settle();
        } else if (delta > 0) {
            poolManager.take(currency, address(this), uint256(uint128(delta)));
        }
    }
}
