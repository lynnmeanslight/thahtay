// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {Position, PositionLib} from "../src/libraries/PositionLib.sol";

/// @notice Unit tests for PositionLib math functions
contract PositionLibTest is Test {
    using PositionLib for Position;

    function _makePosition(
        bool isLong,
        uint256 size,
        uint256 margin,
        uint256 entryPrice,
        uint256 leverage
    ) internal view returns (Position memory) {
        return Position({
            trader: address(this),
            isLong: isLong,
            size: size,
            margin: margin,
            entryPrice: entryPrice,
            leverage: leverage,
            lastFundingIndex: 1e18,
            openedAt: block.timestamp
        });
    }

    // ─── unrealizedPnl ───────────────────────────────────────────────────

    function test_pnl_long_profit() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: true,
            size: 10_000e18,       // $10k notional
            margin: 1000e18,       // $1k margin
            entryPrice: 2000e18,   // ETH at $2000
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        // Price moves to $2200 (+10%)
        int256 pnl = PositionLib.unrealizedPnl(pos, 2200e18);
        // Expected PnL = 10000 * (2200-2000)/2000 = 10000 * 0.1 = 1000
        assertEq(pnl, 1000e18);
    }

    function test_pnl_long_loss() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: true,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 2000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        // Price drops to $1800 (-10%)
        int256 pnl = PositionLib.unrealizedPnl(pos, 1800e18);
        assertEq(pnl, -1000e18);
    }

    function test_pnl_short_profit() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: false,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 2000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        // Price drops to $1800 (-10%) → short profits
        int256 pnl = PositionLib.unrealizedPnl(pos, 1800e18);
        assertEq(pnl, 1000e18);
    }

    function test_pnl_short_loss() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: false,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 2000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        // Price rises to $2200 → short loses
        int256 pnl = PositionLib.unrealizedPnl(pos, 2200e18);
        assertEq(pnl, -1000e18);
    }

    function test_pnl_zero_price_movement() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: true,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 2000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        assertEq(PositionLib.unrealizedPnl(pos, 2000e18), 0);
    }

    // ─── isLiquidatable ──────────────────────────────────────────────────

    function test_isLiquidatable_healthy() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: true,
            size: 10_000e18,
            margin: 1000e18,     // 10% margin ratio — above 5% threshold
            entryPrice: 3000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        assertFalse(PositionLib.isLiquidatable(pos, 3000e18));
    }

    function test_isLiquidatable_at_entry_10x() public pure {
        // At 10x leverage, maintenance is 5% of $10k = $500
        // effectiveMargin at entry = $1000 > $500 → healthy
        Position memory pos = Position({
            trader: address(0),
            isLong: true,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 3000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        assertFalse(PositionLib.isLiquidatable(pos, 3000e18));
    }

    function test_isLiquidatable_triggers_at_correct_price() public pure {
        // 10x: $1000 margin, $10000 size
        // Liq when EM < 500 → 1000 + 10000*(p-3000)/3000 < 500
        // 10000*(p-3000)/3000 < -500  → p-3000 < -150 → p < 2850
        // At $2715: PnL = 10000*(2715-3000)/3000 = -950; EM = 1000-950 = 50 < 500 ✓
        Position memory pos = Position({
            trader: address(0),
            isLong: true,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 3000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        assertTrue(PositionLib.isLiquidatable(pos, 2715e18));
    }

    // ─── liquidationPrice ────────────────────────────────────────────────

    function test_liquidationPrice_long_below_entry() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: true,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 3000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        uint256 liqPrice = PositionLib.liquidationPrice(pos);
        assertTrue(liqPrice < pos.entryPrice, "Long liq price must be below entry");
        console2.log("Long liq price:", liqPrice);
    }

    function test_liquidationPrice_short_above_entry() public pure {
        Position memory pos = Position({
            trader: address(0),
            isLong: false,
            size: 10_000e18,
            margin: 1000e18,
            entryPrice: 3000e18,
            leverage: 10,
            lastFundingIndex: 1e18,
            openedAt: 0
        });
        uint256 liqPrice = PositionLib.liquidationPrice(pos);
        assertTrue(liqPrice > pos.entryPrice, "Short liq price must be above entry");
    }

    // ─── Fuzz ────────────────────────────────────────────────────────────

    function testFuzz_pnl_symmetry(
        uint256 size,
        uint256 entryPrice,
        uint256 currentPrice
    ) public pure {
        size = bound(size, 1e6, 1_000_000e6);
        entryPrice = bound(entryPrice, 100e18, 1_000_000e18);
        currentPrice = bound(currentPrice, 100e18, 1_000_000e18);

        Position memory longPos = Position({
            trader: address(0), isLong: true, size: size,
            margin: size / 10, entryPrice: entryPrice, leverage: 10,
            lastFundingIndex: 1e18, openedAt: 0
        });
        Position memory shortPos = Position({
            trader: address(0), isLong: false, size: size,
            margin: size / 10, entryPrice: entryPrice, leverage: 10,
            lastFundingIndex: 1e18, openedAt: 0
        });

        int256 longPnl  = PositionLib.unrealizedPnl(longPos, currentPrice);
        int256 shortPnl = PositionLib.unrealizedPnl(shortPos, currentPrice);

        // Long and short PnL should net to zero for the same price move.
        assertEq(longPnl + shortPnl, 0);
    }
}
