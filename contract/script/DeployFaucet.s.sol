// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {USDCFaucet} from "../src/USDCFaucet.sol";

/// @title DeployFaucet
/// @notice Deploys the USDCFaucet promotional contract and optionally seeds it.
///
/// Required env vars:
///   PRIVATE_KEY          — deployer private key
///   USDC_ADDRESS         — USDC token address on the target chain
///
/// Optional env vars:
///   DEPLOYER_ADDRESS     — owner of the faucet (defaults to tx sender)
///   FAUCET_SEED_AMOUNT   — USDC amount (raw, 6 dec) to seed immediately (default 0)
///
/// Usage:
///   forge script script/DeployFaucet.s.sol:DeployFaucet \
///     --rpc-url $UNICHAIN_SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify
contract DeployFaucet is Script {
    address constant DEFAULT_USDC = 0x631FEDecA55Aa01aD5844E94ecB604caF29bfdb4; // Mock USDC on Unichain Sepolia

    function run() external {
        address usdc    = vm.envOr("USDC_ADDRESS", DEFAULT_USDC);
        uint256 privKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privKey);
        uint256 seed    = vm.envOr("FAUCET_SEED_AMOUNT", uint256(0));

        vm.startBroadcast(privKey);

        USDCFaucet faucet = new USDCFaucet(usdc, deployer);
        console2.log("USDCFaucet deployed:", address(faucet));
        console2.log("USDC token:         ", usdc);
        console2.log("Owner:              ", deployer);

        // Optionally seed the faucet with an initial USDC balance
        if (seed > 0) {
            IERC20(usdc).approve(address(faucet), seed);
            faucet.fund(seed);
            console2.log("Seeded faucet with:", seed, "USDC (raw units)");
        }

        vm.stopBroadcast();
    }
}
