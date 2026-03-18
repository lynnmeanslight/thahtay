// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IWETH9 {
    function deposit() external payable;
    function withdraw(uint256) external;
}


/// @notice Minimal mintable ERC20 for testnet USDC simulation
contract MockUSDC is ERC20 {
    address public owner;
    constructor() ERC20("Mock USDC", "USDC") {
        owner = msg.sender;
        _mint(msg.sender, 1_000_000 * 1e6); // 1M USDC
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) { return 6; }
}

/// @notice Minimal mintable ERC20 for testnet WETH simulation
contract MockWETH is ERC20 {
    address public owner;
    constructor() ERC20("Mock WETH", "WETH") {
        owner = msg.sender;
        _mint(msg.sender, 1000 * 1e18); // 1000 WETH
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        _mint(to, amount);
    }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }

    function decimals() public pure override returns (uint8) { return 18; }
    
    receive() external payable {
        this.deposit();
    }
}

/// @title MintTestTokens
/// @notice Helper script to mint testnet tokens for development
contract MintTestTokens is Script {
    function run() external {
        address recipient = vm.envAddress("DEPLOYER_ADDRESS");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC deployed: ", address(usdc));
        console2.log("Minted 1,000,000 USDC to: ", recipient);

        // Mint extra if needed
        usdc.mint(recipient, 9_000_000 * 1e6); // 10M total
        console2.log("Total USDC balance: ", usdc.balanceOf(recipient));

        MockWETH weth = new MockWETH();
        console2.log("MockWETH deployed: ", address(weth));
        console2.log("Minted 1000 WETH to: ", recipient);
        console2.log("Total WETH balance: ", weth.balanceOf(recipient));

        vm.stopBroadcast();
    }
}
