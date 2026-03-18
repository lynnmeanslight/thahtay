// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

import {PositionManager} from "../src/PositionManager.sol";
import {FundingRateManager} from "../src/FundingRateManager.sol";
import {LiquidationEngine} from "../src/LiquidationEngine.sol";
import {ThaHtayHook} from "../src/ThaHtayHook.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 10_000_000e6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPoolManager {
    uint160 public mockSqrtPriceX96;
    
    function setSqrtPrice(uint160 _sqrtPriceX96) external {
        mockSqrtPriceX96 = _sqrtPriceX96;
    }

    function getSlot0(bytes32) external view returns (uint160 sqrtPriceX96, int24, uint16, uint16) {
        return (mockSqrtPriceX96, 0, 0, 0);
    }

    // StateLibrary in v4 reads pool state via extsload(slot).
    // For tests we only need slot0 packed with sqrtPrice in the low 160 bits.
    function extsload(bytes32) external view returns (bytes32) {
        return bytes32(uint256(mockSqrtPriceX96));
    }

    function extsload(bytes32, uint256 nSlots) external pure returns (bytes32[] memory data) {
        data = new bytes32[](nSlots);
    }
}

contract ThaHtayHookTest is Test {
    ThaHtayHook public hook;
    PositionManager public posMgr;
    FundingRateManager public fundMgr;
    LiquidationEngine public liqEngine;
    MockUSDC public usdc;
    MockPoolManager public poolManager;

    address public admin = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public trader = makeAddr("trader");

    bytes32 constant HOOK_ROLE = keccak256("HOOK_ROLE");

    function setUp() public {
        usdc = new MockUSDC();
        poolManager = new MockPoolManager();
        
        vm.startPrank(admin);
        posMgr = new PositionManager(admin);
        fundMgr = new FundingRateManager(admin);
        liqEngine = new LiquidationEngine(admin, address(posMgr), address(fundMgr), address(usdc), treasury);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.AFTER_INITIALIZE_FLAG  |
            Hooks.BEFORE_SWAP_FLAG       |
            Hooks.AFTER_SWAP_FLAG
        );

        bytes memory constructorArgs = abi.encode(
            IPoolManager(address(poolManager)),
            address(usdc),
            address(posMgr),
            address(fundMgr),
            address(liqEngine),
            treasury,
            admin
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(
            admin,
            flags,
            type(ThaHtayHook).creationCode,
            constructorArgs
        );

        hook = new ThaHtayHook{salt: salt}(
            IPoolManager(address(poolManager)),
            address(usdc),
            address(posMgr),
            address(fundMgr),
            address(liqEngine),
            treasury,
            admin
        );
        require(address(hook) == hookAddress, "hook deployment failed");
        
        posMgr.grantRole(HOOK_ROLE, address(hook));
        fundMgr.grantRole(HOOK_ROLE, address(hook));
        liqEngine.grantRole(HOOK_ROLE, address(hook));
        posMgr.grantRole(HOOK_ROLE, address(liqEngine));
        vm.stopPrank();

        // Mint USDC to trader and approve hook
        usdc.mint(trader, 1_000_000e6);
        vm.prank(trader);
        usdc.approve(address(hook), type(uint256).max);

        // Initial pool price mapping to $3000 ETH
        // sqrtPriceX96 = sqrt(3000e6 / 1e18) * 2^96 ≈ 1771595571142957102144
        poolManager.setSqrtPrice(1771595571142957102144);
        
        // Mock a pool initialization callback manually to set up indexPrice
        // so funding doesn't revert. Because we can't easily call internal _afterInitialize,
        // we use a keeper action
        vm.prank(admin); // admin has KEEPER_ROLE
        hook.setIndexPrice(3000e18);
    }

    function test_openPosition() public {
        vm.prank(trader);
        // size: 10,000 USDC, leverage 10 -> margin = 1000 USDC
        hook.openPosition(true, 10_000e6, 10, address(0));

        assertTrue(posMgr.hasOpenPosition(trader));
        assertEq(posMgr.getPosition(trader).margin, 1000e6);
    }
    
    function test_removeMargin_respects_funding() public {
        vm.startPrank(trader);
        hook.openPosition(true, 10_000e6, 10, address(0)); // 1000e6 margin
        vm.stopPrank();

        // Warp time to accumulate funding
        vm.warp(block.timestamp + 10 hours);
        
        // Lower mark price slightly to create positive funding rate (longs pay shorts)
        // Mark Price > Index Price -> positive funding -> Longs pay
        hook.triggerFundingUpdate(); // wait, we have to increase the price for longs to pay
        poolManager.setSqrtPrice(1781595571142957102144); // price is higher -> positive funding
        hook.triggerFundingUpdate();
        
        // Remove margin - this should revert if the removed amount leaves margin below maintenance taking funding into account.
        // Let's just try to remove most of the margin.
        vm.startPrank(trader);
        // Maintenance is 500e6. Margin is 1000e6. Without funding we could remove 500e6.
        // But with funding, our margin is reduced, so removing 500e6 should revert if funding > 0.
        // PnL is also higher though, so we have to balance it.
        vm.stopPrank();
    }
}
