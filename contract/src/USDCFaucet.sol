// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title USDCFaucet
/// @notice Promotional faucet that lets each wallet claim 100 USDC once.
///         The owner funds the faucet by calling `fund()` after approving USDC,
///         or by transferring USDC directly to this contract.
contract USDCFaucet is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    /// @notice Fixed amount dispensed per wallet: 100 USDC (6 decimals)
    uint256 public constant CLAIM_AMOUNT = 100 * 1e6;

    /// @notice Tracks wallets that have already claimed
    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed wallet, uint256 amount);
    event Funded(address indexed funder, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);

    error AlreadyClaimed();
    error InsufficientFaucetBalance();

    constructor(address _usdc, address _owner) Ownable(_owner) {
        usdc = IERC20(_usdc);
    }

    /// @notice Claim 100 USDC. Each wallet may call this exactly once.
    function claim() external {
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();
        if (usdc.balanceOf(address(this)) < CLAIM_AMOUNT) revert InsufficientFaucetBalance();

        hasClaimed[msg.sender] = true;
        usdc.safeTransfer(msg.sender, CLAIM_AMOUNT);

        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }

    /// @notice Fund the faucet. Caller must have approved this contract to spend USDC.
    function fund(uint256 amount) external {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    /// @notice Withdraw remaining USDC back to the owner (end of campaign).
    function withdraw(uint256 amount) external onlyOwner {
        usdc.safeTransfer(owner(), amount);
        emit Withdrawn(owner(), amount);
    }

    /// @notice Current USDC balance held by the faucet.
    function faucetBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
