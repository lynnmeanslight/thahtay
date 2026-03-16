// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {LiquidationEngine} from "../src/LiquidationEngine.sol";
import {ILiquidationEngine} from "../src/interfaces/ILiquidationEngine.sol";
import {PositionManager} from "../src/PositionManager.sol";
import {Position, PositionLib} from "../src/libraries/PositionLib.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 1_000_000e6);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract LiquidationEngineTest is Test {
    LiquidationEngine public liqEngine;
    PositionManager   public posMgr;
    MockUSDC          public usdc;

    address admin     = makeAddr("admin");
    address hook      = makeAddr("hook");
    address trader    = makeAddr("trader");
    address liquidator = makeAddr("liquidator");
    address treasury  = makeAddr("treasury");

    bytes32 constant HOOK_ROLE = keccak256("HOOK_ROLE");

    function setUp() public {
        vm.startPrank(admin);
        usdc      = new MockUSDC();
        posMgr    = new PositionManager(admin);
        liqEngine = new LiquidationEngine(admin, address(posMgr), address(usdc), treasury);

        posMgr.grantRole(HOOK_ROLE, hook);
        posMgr.grantRole(HOOK_ROLE, address(liqEngine));
        liqEngine.grantRole(HOOK_ROLE, hook);
        vm.stopPrank();

        // Fund liqEngine with USDC to simulate margin held there
        vm.prank(admin);
        usdc.transfer(address(liqEngine), 100_000e6);
    }

    // ─── checkLiquidation ────────────────────────────────────────────────

    function test_checkLiquidation_false_no_position() public view {
        assertFalse(liqEngine.checkLiquidation(trader, 3000e18));
    }

    function test_checkLiquidation_false_healthy_position() public {
        // 10x leverage, $1000 margin, $10000 size — at $3000 entry
        vm.prank(hook);
        posMgr.openPosition(trader, true, 10_000e6, 1000e6, 3000e18, 10, 1e18);

        // Price hasn't moved much — should not be liquidatable
        assertFalse(liqEngine.checkLiquidation(trader, 3000e18));
    }

    function test_checkLiquidation_true_underwater() public {
        // 10x leverage: $1000 margin; $10000 size; entry $3000
        // Maintenance margin: 5% of $10000 = $500
        // Liquidation when effective margin < $500
        // effectiveMargin = 1000 + PnL = 1000 + 10000*(currentPrice-3000)/3000
        // At $2715 (9.5% drop): PnL = 10000*(2715-3000)/3000 = -950 → EM = 50 < 500 ✓
        vm.prank(hook);
        posMgr.openPosition(trader, true, 10_000e6, 1000e6, 3000e18, 10, 1e18);

        assertTrue(liqEngine.checkLiquidation(trader, 2715e18));
    }

    // ─── liquidatePosition ───────────────────────────────────────────────

    function test_liquidatePosition_transfers_bonus() public {
        // Open a liquidatable position
        vm.prank(hook);
        posMgr.openPosition(trader, true, 10_000e6, 1000e6, 3000e18, 10, 1e18);

        uint256 liquidatorBalBefore = usdc.balanceOf(liquidator);
        uint256 treasuryBalBefore   = usdc.balanceOf(treasury);

        vm.prank(hook);
        liqEngine.liquidatePosition(trader, liquidator);

        // Liquidator received bonus
        assertTrue(usdc.balanceOf(liquidator) > liquidatorBalBefore);
        // Treasury received remainder
        assertTrue(usdc.balanceOf(treasury) > treasuryBalBefore);
        // Position is closed
        assertFalse(posMgr.hasOpenPosition(trader));
    }

    function test_liquidatePosition_reverts_cooldown() public {
        vm.prank(hook);
        posMgr.openPosition(trader, true, 10_000e6, 1000e6, 3000e18, 10, 1e18);

        vm.startPrank(hook);
        liqEngine.liquidatePosition(trader, liquidator);

        // Re-open a position (simulate)
        posMgr.openPosition(trader, true, 10_000e6, 1000e6, 3000e18, 10, 1e18);

        // Same block — should revert with cooldown
        vm.expectRevert(ILiquidationEngine.LiquidationEngine__CooldownActive.selector);
        liqEngine.liquidatePosition(trader, liquidator);
        vm.stopPrank();
    }

    function test_liquidatePosition_reverts_no_position() public {
        vm.prank(hook);
        vm.expectRevert(ILiquidationEngine.LiquidationEngine__NoOpenPosition.selector);
        liqEngine.liquidatePosition(trader, liquidator);
    }

    // ─── Liquidation bonus math ──────────────────────────────────────────

    function test_liquidation_bonus_is_5_percent() public {
        vm.prank(hook);
        posMgr.openPosition(trader, true, 10_000e6, 1000e6, 3000e18, 10, 1e18);

        uint256 liquidatorBalBefore = usdc.balanceOf(liquidator);
        uint256 treasuryBalBefore   = usdc.balanceOf(treasury);

        vm.prank(hook);
        liqEngine.liquidatePosition(trader, liquidator);

        uint256 liquidatorGain = usdc.balanceOf(liquidator) - liquidatorBalBefore;
        uint256 treasuryGain   = usdc.balanceOf(treasury)   - treasuryBalBefore;

        assertEq(liquidatorGain, 50e6);
        assertEq(treasuryGain, 950e6);
    }
}
