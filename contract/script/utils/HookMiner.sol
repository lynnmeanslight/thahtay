// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

/// @title HookMiner
/// @notice Utility to mine a CREATE2 salt such that the resulting hook address
///         has the correct lower-bit flags required by Uniswap v4.
///
///         In Uniswap v4, a hook address encodes which callbacks it implements
///         in the lower 14 bits of the address. The PoolManager validates these
///         bits against getHookPermissions() at pool initialization.
///
/// @dev Adapted from Uniswap v4 template tooling.
library HookMiner {
    uint160 constant ADDRESS_MASK = uint160(~uint256(0) >> (256 - 20 * 8));

    /// @notice Find a salt that produces a hook address with the correct flags.
    /// @param deployer       The address that will call CREATE2 (msg.sender / factory)
    /// @param flags          The required lower-bit flags (uint160)
    /// @param creationCode   The bytecode of the hook contract
    /// @param constructorArgs ABI-encoded constructor arguments
    /// @return hookAddress   The address the hook will deploy to
    /// @return salt          The salt to use in CREATE2
    function find(
        address deployer,
        uint160 flags,
        bytes memory creationCode,
        bytes memory constructorArgs
    ) internal pure returns (address hookAddress, bytes32 salt) {
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);

        for (uint256 i = 0; i < 200_000; i++) {
            salt = bytes32(i);
            hookAddress = computeCreate2Address(deployer, salt, initCodeHash);
            if (uint160(hookAddress) & flags == flags) {
                return (hookAddress, salt);
            }
        }
        revert("HookMiner: could not find salt in 200k iterations");
    }

    /// @notice Compute CREATE2 address.
    function computeCreate2Address(
        address deployer,
        bytes32 salt,
        bytes32 initCodeHash
    ) internal pure returns (address) {
        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)
                    )
                )
            )
        );
    }
}
