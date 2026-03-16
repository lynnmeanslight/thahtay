// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {PositionManager} from "../src/PositionManager.sol";
import {IPositionManager} from "../src/interfaces/IPositionManager.sol";
import {Position, PositionLib} from "../src/libraries/PositionLib.sol";

/// @title PositionManagerTest
/// @notice Unit tests for PositionManager.sol
contract PositionManagerTest is Test {
    PositionManager public posMgr;

    address public admin  = makeAddr("admin");
    address public hook   = makeAddr("hook");
    address public trader = makeAddr("trader");

    bytes32 constant HOOK_ROLE = keccak256("HOOK_ROLE");

    function setUp() public {
        vm.startPrank(admin);
        posMgr = new PositionManager(admin);
        posMgr.grantRole(HOOK_ROLE, hook);
        vm.stopPrank();
    }

    // ─── openPosition ────────────────────────────────────────────────────

    function test_openPosition_basic() public {
        vm.prank(hook);
        posMgr.openPosition(trader, true, 1000e18, 100e18, 3000e18, 10, 1e18);

        Position memory pos = posMgr.getPosition(trader);
        assertEq(pos.trader,    trader);
        assertTrue(pos.isLong);
        assertEq(pos.size,      1000e18);
        assertEq(pos.margin,    100e18);
        assertEq(pos.entryPrice, 3000e18);
        assertEq(pos.leverage,  10);
        assertTrue(posMgr.hasOpenPosition(trader));
    }

    function test_openPosition_reverts_if_already_open() public {
        vm.startPrank(hook);
        posMgr.openPosition(trader, true, 1000e18, 100e18, 3000e18, 5, 1e18);
        vm.expectRevert(IPositionManager.PositionManager__PositionAlreadyOpen.selector);
        posMgr.openPosition(trader, false, 500e18, 50e18, 3000e18, 5, 1e18);
        vm.stopPrank();
    }

    function test_openPosition_reverts_invalid_leverage() public {
        vm.prank(hook);
        vm.expectRevert(IPositionManager.PositionManager__InvalidLeverage.selector);
        posMgr.openPosition(trader, true, 1000e18, 100e18, 3000e18, 11, 1e18);
    }

    function test_openPosition_reverts_zero_size() public {
        vm.prank(hook);
        vm.expectRevert(IPositionManager.PositionManager__InvalidSize.selector);
        posMgr.openPosition(trader, true, 0, 100e18, 3000e18, 5, 1e18);
    }

    function test_openPosition_reverts_non_hook() public {
        vm.prank(trader);
        vm.expectRevert(IPositionManager.PositionManager__NotHook.selector);
        posMgr.openPosition(trader, true, 1000e18, 100e18, 3000e18, 5, 1e18);
    }

    // ─── closePosition ───────────────────────────────────────────────────

    function test_closePosition_clears_state() public {
        vm.startPrank(hook);
        posMgr.openPosition(trader, true, 1000e18, 100e18, 3000e18, 10, 1e18);
        posMgr.closePosition(trader);
        vm.stopPrank();

        assertFalse(posMgr.hasOpenPosition(trader));
        Position memory pos = posMgr.getPosition(trader);
        assertEq(pos.size, 0);
    }

    function test_closePosition_reverts_no_position() public {
        vm.prank(hook);
        vm.expectRevert(IPositionManager.PositionManager__NoOpenPosition.selector);
        posMgr.closePosition(trader);
    }

    // ─── addMargin ───────────────────────────────────────────────────────

    function test_addMargin_increases_margin() public {
        vm.startPrank(hook);
        posMgr.openPosition(trader, true, 1000e18, 100e18, 3000e18, 10, 1e18);
        posMgr.addMargin(trader, 50e18);
        vm.stopPrank();

        Position memory pos = posMgr.getPosition(trader);
        assertEq(pos.margin, 150e18);
    }

    // ─── removeMargin ────────────────────────────────────────────────────

    function test_removeMargin_decreases_margin() public {
        vm.startPrank(hook);
        posMgr.openPosition(trader, true, 1000e18, 200e18, 3000e18, 5, 1e18);
        uint256 newMargin = posMgr.removeMargin(trader, 50e18);
        vm.stopPrank();

        assertEq(newMargin, 150e18);
        assertEq(posMgr.getPosition(trader).margin, 150e18);
    }

    function test_removeMargin_reverts_insufficient() public {
        vm.startPrank(hook);
        posMgr.openPosition(trader, true, 1000e18, 100e18, 3000e18, 10, 1e18);
        vm.expectRevert(IPositionManager.PositionManager__InsufficientMargin.selector);
        posMgr.removeMargin(trader, 200e18);
        vm.stopPrank();
    }

    // ─── Fuzz ────────────────────────────────────────────────────────────

    function testFuzz_openAndClose(
        uint256 size,
        uint256 margin,
        uint256 price,
        uint256 leverage
    ) public {
        size     = bound(size, 1, 1e30);
        margin   = bound(margin, 1, 1e30);
        price    = bound(price, 1, 1e30);
        leverage = bound(leverage, 1, 10);

        vm.startPrank(hook);
        posMgr.openPosition(trader, true, size, margin, price, leverage, 1e18);
        assertTrue(posMgr.hasOpenPosition(trader));
        posMgr.closePosition(trader);
        assertFalse(posMgr.hasOpenPosition(trader));
        vm.stopPrank();
    }
}
