// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title PriceLib
/// @notice Utility functions for converting Uniswap v4 price representations
library PriceLib {
    // Q96 = 2^96
    uint256 internal constant Q96 = 2 ** 96;

    // Price is expressed with 18 decimal places
    uint256 internal constant PRICE_PRECISION = 1e18;

    /// @notice Convert sqrtPriceX96 → price (token1 per token0) with 18 decimals
    /// @dev price = (sqrtPriceX96 / 2^96)^2
    ///      To preserve precision: price = sqrtPriceX96^2 / 2^192
    ///      We scale by 1e18: price = sqrtPriceX96^2 * 1e18 / 2^192
    /// @param sqrtPriceX96  The sqrt price in Q96 format from slot0
    /// @param token0Decimals Decimals of token0 (e.g., 18 for WETH)
    /// @param token1Decimals Decimals of token1 (e.g., 6 for USDC)
    /// @return price Price of token0 in units of token1, scaled by 1e18
    function sqrtPriceX96ToPrice(
        uint160 sqrtPriceX96,
        uint8 token0Decimals,
        uint8 token1Decimals
    ) internal pure returns (uint256 price) {
        // Calculate (sqrtPrice)^2 in 192-bit fixed point
        // Use 256-bit intermediate to avoid overflow
        uint256 sq = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);

        // Adjust for token decimal difference
        // price (token1/token0) = sq * 10^(token0Decimals - token1Decimals) / 2^192 * 1e18
        uint256 decimalAdjust;
        if (token0Decimals >= token1Decimals) {
            decimalAdjust = 10 ** (token0Decimals - token1Decimals);
            price = mulDiv(sq, PRICE_PRECISION * decimalAdjust, 1 << 192);
        } else {
            decimalAdjust = 10 ** (token1Decimals - token0Decimals);
            price = mulDiv(sq, PRICE_PRECISION, (1 << 192) * decimalAdjust);
        }
    }

    /// @notice Simplified price conversion for token0=WETH (18 dec), token1=USDC (6 dec)
    ///         Returns price of ETH in USDC with 18 decimal precision
    function sqrtPriceX96ToEthUsdcPrice(uint160 sqrtPriceX96) internal pure returns (uint256 price) {
        // WETH=18 dec, USDC=6 dec → decimalAdjust = 10^12
        // price = sqrtPriceX96^2 * 1e18 * 1e12 / 2^192
        uint256 sq = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        price = mulDiv(sq, 1e30, 1 << 192);
    }

    /// @notice Full-precision multiplication then division: floor(a * b / c)
    ///         Reverts on overflow or division by zero.
    function mulDiv(
        uint256 a,
        uint256 b,
        uint256 c
    ) internal pure returns (uint256 result) {
        require(c != 0, "PriceLib: div by zero");

        // Use 512-bit multiplication via mulmod trick to avoid overflow
        uint256 prod0; // Least significant 256 bits
        uint256 prod1; // Most significant 256 bits
        assembly {
            let mm := mulmod(a, b, not(0))
            prod0 := mul(a, b)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }

        if (prod1 == 0) {
            return prod0 / c;
        }

        // Ensure result fits in 256 bits
        require(prod1 < c, "PriceLib: overflow");

        // Compute 512-bit numerator mod c for remainder
        uint256 remainder;
        assembly {
            remainder := mulmod(a, b, c)
        }

        // Subtract remainder from 512-bit number
        assembly {
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }

        // Factor powers of two out of c
        uint256 twos = c & (~c + 1);
        assembly {
            c := div(c, twos)
            prod0 := div(prod0, twos)
        }
        assembly {
            twos := add(div(sub(0, twos), twos), 1)
        }
        prod0 |= prod1 * twos;

        // Invert c mod 2^256 using Newton-Raphson
        uint256 inv = (3 * c) ^ 2;
        inv *= 2 - c * inv;
        inv *= 2 - c * inv;
        inv *= 2 - c * inv;
        inv *= 2 - c * inv;
        inv *= 2 - c * inv;
        inv *= 2 - c * inv;

        result = prod0 * inv;
    }
}
