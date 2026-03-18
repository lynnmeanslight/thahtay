// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {ThaHtayHook} from "../src/ThaHtayHook.sol";
import {PositionManager} from "../src/PositionManager.sol";
import {FundingRateManager} from "../src/FundingRateManager.sol";
import {LiquidationEngine} from "../src/LiquidationEngine.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

/// @title DeployScript
/// @notice End-to-end deployment of ThaHtayHook protocol.
///
/// Usage:
///   forge script script/Deploy.s.sol:DeployScript \
///     --rpc-url $UNICHAIN_SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify
contract DeployScript is Script {
    // Uniswap v4 PoolManager on Unichain Sepolia
    // Update this after official Uniswap v4 Unichain deployment is published.
    address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;

    // Unichain Sepolia token addresses (update before deploying)
    address constant WETH   = 0x4200000000000000000000000000000000000006;
    address constant USDC   = 0x31d0220469e10c4E71834a79b1f276d740d3768F;

    // Pool fee tier: 0.3%
    uint24 constant POOL_FEE = 3000;
    // Initial sqrt price — ETH at ~$3000
    // sqrtPriceX96 = sqrt(3000e6 / 1e18) * 2^96 ≈ 1771595571142957102 * 2^96
    uint160 constant INITIAL_SQRT_PRICE = 1771595571142957102144;

    function run() external {
        address deployer = vm.envAddress("DEPLOYER_ADDRESS");
        address treasury = vm.envOr("PROTOCOL_TREASURY", deployer);
        address poolMgr  = vm.envOr("POOL_MANAGER_ADDRESS", POOL_MANAGER);
        address usdc     = vm.envOr("USDC_ADDRESS", USDC);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // ── 1. Deploy supporting contracts ────────────────────────────────
        PositionManager posMgr = new PositionManager(deployer);
        console2.log("PositionManager:    ", address(posMgr));

        FundingRateManager fundMgr = new FundingRateManager(deployer);
        console2.log("FundingRateManager: ", address(fundMgr));

        // ── 2. Deploy LiquidationEngine before mining ─────────────────────
        // LiquidationEngine only needs posMgr/usdc/treasury — no hook dependency.
        // Deploying here lets us include its real address in the CREATE2 hash,
        // so the mined salt and the final deployed hook address will match.
        LiquidationEngine liqEngine = new LiquidationEngine(
            deployer,
            address(posMgr),
            address(fundMgr),
            usdc,
            treasury
        );
        console2.log("LiquidationEngine:  ", address(liqEngine));

        // ── 3. Mine hook address with correct flag bits ───────────────────
        // Required flags: BEFORE_INITIALIZE | AFTER_INITIALIZE | BEFORE_SWAP | AFTER_SWAP
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.AFTER_INITIALIZE_FLAG  |
            Hooks.BEFORE_SWAP_FLAG       |
            Hooks.AFTER_SWAP_FLAG
        );

        // Pack constructor args with the real liquidationEngine address
        bytes memory constructorArgs = abi.encode(
            IPoolManager(poolMgr),
            usdc,
            address(posMgr),
            address(fundMgr),
            address(liqEngine),
            treasury,
            deployer
        );

        bytes memory creationCode = type(ThaHtayHook).creationCode;
        // Foundry's broadcast deploys CREATE2 contracts via its deterministic
        // factory at 0x4e59b44847b379578588920cA78FbF26c0B4956C, so the salt
        // must be mined using that address as the CREATE2 `from`, not the EOA.
        address create2Factory = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        (address hookAddress, bytes32 salt) = HookMiner.find(
            create2Factory,
            flags,
            creationCode,
            constructorArgs
        );
        console2.log("Mined hook address: ", hookAddress);
        console2.log("Salt:               ", vm.toString(salt));

        // ── 4. Deploy ThaHtayHook at mined address ─────────────────────────
        ThaHtayHook hook = new ThaHtayHook{salt: salt}(
            IPoolManager(poolMgr),
            usdc,
            address(posMgr),
            address(fundMgr),
            address(liqEngine),
            treasury,
            deployer
        );
        require(address(hook) == hookAddress, "Deploy: hook address mismatch -- re-mine salt");
        console2.log("ThaHtayHook:        ", address(hook));

        // ── 5. Grant HOOK_ROLE to ThaHtayHook on all supporting contracts ──
        bytes32 HOOK_ROLE = keccak256("HOOK_ROLE");
        posMgr.grantRole(HOOK_ROLE, address(hook));
        fundMgr.grantRole(HOOK_ROLE, address(hook));
        liqEngine.grantRole(HOOK_ROLE, address(hook));
        console2.log("HOOK_ROLE granted");

        // ── 6. Initialize the Uniswap v4 pool ─────────────────────────────
        // Sort tokens: Uniswap v4 requires currency0 < currency1
        address token0 = WETH < usdc ? WETH : usdc;
        address token1 = WETH < usdc ? usdc : WETH;

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: POOL_FEE,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });

        IPoolManager(poolMgr).initialize(key, INITIAL_SQRT_PRICE);
        console2.log("Pool initialized");

        vm.stopBroadcast();

        // ── 7. Print deployment summary ────────────────────────────────────
        console2.log("\n=== ThaHtayHook Deployment Summary ===");
        console2.log("Network:             Unichain Sepolia");
        console2.log("ThaHtayHook:        ", address(hook));
        console2.log("PositionManager:    ", address(posMgr));
        console2.log("FundingRateManager: ", address(fundMgr));
        console2.log("LiquidationEngine:  ", address(liqEngine));
        console2.log("Treasury:           ", treasury);
        console2.log("USDC:               ", usdc);
        console2.log("PoolManager:        ", poolMgr);
        console2.log("=======================================\n");
    }
}
