// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PriceKeeper} from "../src/PriceKeeper.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeployPriceKeeperScript
/// @notice Deploys PriceKeeper and seeds it with an initial token balance.
///
/// Usage:
///   forge script script/DeployPriceKeeper.s.sol:DeployPriceKeeperScript \
///     --rpc-url https://unichain-sepolia.g.alchemy.com/v2/YMzKKvdFJU9ZBB0r2yGuo \
///     --private-key $PRIVATE_KEY \
///     --broadcast
///
/// After deployment, set PRICE_KEEPER_ADDRESS in keeper/.env and run keeper.js.
contract DeployPriceKeeperScript is Script {
    // ── Unichain Sepolia deployed addresses ───────────────────────────────
    address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    address constant HOOK         = 0xAB307e812680b93E32BF23126e8a11924ea2B0C0;

    // On this deployment, WETH < USDC by address value, so WETH = currency0.
    address constant WETH = 0xAb69B88033A540442D9FD8A64e8Db8302297572d;
    address constant USDC = 0x631FEDecA55Aa01aD5844E94ecB604caF29bfdb4;

    // Pool parameters — must match the initialised pool exactly
    uint24 constant FEE          = 3000; // 0.3%
    int24  constant TICK_SPACING = 60;

    // Token seed — deployer must hold these balances
    // Keeper needs USDC to buy ETH when pool price < real, and WETH to sell
    // when pool price > real. Start with USDC only if WETH balance is low.
    uint256 constant USDC_SEED = 10_000 * 1e6; // 10,000 USDC (6 decimals)
    uint256 constant WETH_SEED = 3 * 1e18;     //      3 WETH  (18 decimals)

    function run() external {
        uint256 pk      = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        PriceKeeper keeper = new PriceKeeper(
            POOL_MANAGER,
            USDC,          // currency0
            WETH,          // currency1
            FEE,
            TICK_SPACING,
            HOOK
        );
        console2.log("PriceKeeper deployed:", address(keeper));

        // Seed the keeper so it can swing the price in both directions.
        // Skip if deployer balance is insufficient — top up manually afterwards.
        uint256 usdcBal = IERC20(USDC).balanceOf(deployer);
        if (usdcBal >= USDC_SEED) {
            IERC20(USDC).transfer(address(keeper), USDC_SEED);
            console2.log("Seeded USDC:", USDC_SEED);
        } else {
            console2.log("WARN: insufficient USDC - seed manually after deployment");
        }

        uint256 wethBal = IERC20(WETH).balanceOf(deployer);
        if (wethBal >= WETH_SEED) {
            IERC20(WETH).transfer(address(keeper), WETH_SEED);
            console2.log("Seeded WETH:", WETH_SEED);
        } else {
            console2.log("WARN: insufficient WETH - wrap ETH or seed manually");
        }

        vm.stopBroadcast();

        console2.log("---");
        console2.log("Add to keeper/.env:");
        console2.log("  PRICE_KEEPER_ADDRESS=", address(keeper));
    }
}
