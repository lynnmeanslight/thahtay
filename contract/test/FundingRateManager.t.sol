// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {FundingRateManager} from "../src/FundingRateManager.sol";
import {IFundingRateManager} from "../src/interfaces/IFundingRateManager.sol";

contract FundingRateManagerTest is Test {
    FundingRateManager public fundMgr;

    address admin = makeAddr("admin");
    address hook  = makeAddr("hook");

    bytes32 constant HOOK_ROLE = keccak256("HOOK_ROLE");
    uint256 constant PRECISION = 1e18;

    function setUp() public {
        vm.startPrank(admin);
        fundMgr = new FundingRateManager(admin);
        fundMgr.grantRole(HOOK_ROLE, hook);
        vm.stopPrank();
    }

    // ─── updateFunding ───────────────────────────────────────────────────

    function test_updateFunding_reverts_too_early() public {
        vm.prank(hook);
        vm.expectRevert(IFundingRateManager.FundingRateManager__TooEarlyToUpdate.selector);
        fundMgr.updateFunding(3000e18, 2990e18);
    }

    function test_updateFunding_succeeds_after_one_hour() public {
        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        fundMgr.updateFunding(3100e18, 3000e18); // mark > index → longs pay

        // Long index should have increased
        assertTrue(fundMgr.longCumulativeIndex() > PRECISION);
        // Short index unchanged
        assertEq(fundMgr.shortCumulativeIndex(), PRECISION);
        // Funding rate should be positive
        assertTrue(fundMgr.currentFundingRate() > 0);
    }

    function test_updateFunding_negative_rate_short_pays() public {
        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        fundMgr.updateFunding(2900e18, 3000e18); // mark < index → shorts pay

        // Short index should have increased
        assertTrue(fundMgr.shortCumulativeIndex() > PRECISION);
        // Long index unchanged
        assertEq(fundMgr.longCumulativeIndex(), PRECISION);
        assertTrue(fundMgr.currentFundingRate() < 0);
    }

    function test_updateFunding_reverts_non_hook() public {
        vm.warp(block.timestamp + 1 hours);
        vm.expectRevert(IFundingRateManager.FundingRateManager__NotHook.selector);
        fundMgr.updateFunding(3000e18, 3000e18);
    }

    function test_updateFunding_batches_missed_epochs() public {
        // Skip 3 hours
        vm.warp(block.timestamp + 3 hours);
        vm.prank(hook);
        fundMgr.updateFunding(3100e18, 3000e18);

        // Epoch should have advanced by 3
        assertEq(fundMgr.fundingEpoch(), 3);
    }

    // ─── getFundingOwed ──────────────────────────────────────────────────

    function test_getFundingOwed_zero_before_update() public view {
        // Position opened at current index — no delta yet
        uint256 longIdx = fundMgr.longCumulativeIndex();
        int256 owed = fundMgr.getFundingOwed(true, 1000e18, longIdx);
        assertEq(owed, 0);
    }

    function test_getFundingOwed_long_pays_after_positive_rate() public {
        uint256 longIdxAtOpen = fundMgr.longCumulativeIndex();

        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        fundMgr.updateFunding(3100e18, 3000e18);

        int256 owed = fundMgr.getFundingOwed(true, 1000e18, longIdxAtOpen);
        assertTrue(owed > 0, "Long should owe funding");
    }

    function test_getFundingOwed_short_receives_after_positive_rate() public {
        uint256 shortIdxAtOpen = fundMgr.shortCumulativeIndex();

        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        fundMgr.updateFunding(3100e18, 3000e18); // longs pay → shorts receive

        // Short index unchanged (longs pay, shorts don't accumulate here)
        int256 owed = fundMgr.getFundingOwed(false, 1000e18, shortIdxAtOpen);
        assertEq(owed, 0, "Short receives when longs pay -- delta should be 0 for short index");
    }

    // ─── Fuzz ────────────────────────────────────────────────────────────

    function testFuzz_updateFunding_no_revert(uint256 mark, uint256 index) public {
        mark  = bound(mark,  1e18, 1e30);
        index = bound(index, 1e18, 1e30);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(hook);
        fundMgr.updateFunding(mark, index); // Should not revert
    }
}
