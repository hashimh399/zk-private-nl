// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/LendingPool.sol";
import "../../contracts/Vault.sol";
import "../../contracts/Nl.sol";
import "../../contracts/MockOracle.sol";

contract LiquidationTargetedTest is Test {
    LendingPool pool;
    Vault vault;
    NeuroLedger nl;
    MockOracle oracle;

    address admin = makeAddr("admin");
    address borrower = makeAddr("borrower");
    address liquidator = makeAddr("liquidator");

    uint256 constant DAILY_LIMIT = 10_000e18;

    function setUp() public {
        vm.startPrank(admin);

        // 1. Cap is high, supply starts at 0
        nl = new NeuroLedger("NeuroLedger", "NL", 1_000_000_000e18, admin);
        oracle = new MockOracle(2000e8); // $2000 ETH

        // 2. Predict & Deploy
        uint256 nonce = vm.getNonce(admin);
        address predictedPool = vm.computeCreateAddress(admin, nonce + 1);

        vault = new Vault(admin, predictedPool, address(nl), DAILY_LIMIT);
        pool = new LendingPool(
            admin,
            payable(address(vault)),
            address(oracle),
            address(nl)
        );

        // 3. Auth
        nl.grantRole(nl.MINTER_ROLE(), address(vault));

        vm.stopPrank();

        // 4. Fund Actors
        vm.deal(borrower, 100 ether);
        vm.deal(liquidator, 100 ether);
    }
    function invariant_StalePriceNeverUsed() public {
        if (block.timestamp - oracle.lastUpdated() > pool.maxPriceAge()) {
            vm.expectRevert();
            pool.HealthFactor(address(1));
        }
    }

    function test_pause_blocks_state_changes() public {
        vm.prank(admin);
        pool.pause();

        vm.expectRevert();
        pool.deposit{value: 1 ether}();
    }
    function test_liquidate_reverts_on_stale_price() public {
        // 1. SETUP: Create a valid loan first
        vm.startPrank(borrower);
        pool.deposit{value: 10 ether}();
        pool.borrow(1000e18);
        vm.stopPrank();

        // 2. WARP: Move time forward to make price stale
        vm.warp(block.timestamp + 2 days);

        // 3. ACTION: Now attempt liquidation
        // Since borrower has debt, HF calculation will call Oracle -> Revert Stale
        vm.expectRevert("STALE PRICE");
        pool.liquidate(borrower, 1e18);
    }
    function test_collateralValueOf_matches_internal_math() public {
        vm.deal(borrower, 10 ether);
        vm.prank(borrower);
        pool.deposit{value: 2 ether}();

        uint256 price18 = 2000e18;
        uint256 expected = (2 ether * price18) / 1e18;

        assertEq(pool.collateralValueOf(borrower), expected);
    }
    // --- TARGET 1: FORCE LIQUIDATION ---
    function test_ForceLiquidation() public {
        // 1. Borrower deposits 5 ETH ($10,000 at $2000/ETH)
        vm.startPrank(borrower);
        pool.deposit{value: 5 ether}();

        // 2. Borrow 5,000 (Safe LTV = 50%)
        pool.borrow(5_000e18);
        vm.stopPrank();

        // 3. MARKET CORRECTION: Price drops to $1,100 (NOT $500)
        // New Collateral Value = 5 * 1100 = $5,500
        // Debt = $5,000.
        // HF = (5,500 * 0.85) / 5,000 = 0.935 (LIQUIDATABLE but SOLVENT)
        vm.prank(admin);
        oracle.setPrice(1100e8);

        // 4. Liquidator Steps In
        uint256 debt = pool.tokenDebt(borrower);
        uint256 repayAmount = debt / 2; // Close 50%

        // Fund liquidator
        vm.prank(admin);
        nl.mint(liquidator, repayAmount);

        vm.startPrank(liquidator);
        nl.approve(address(pool), repayAmount);

        // HIT THE TARGET
        pool.liquidate(borrower, repayAmount);
        vm.stopPrank();

        // Assertions
        assertLt(pool.tokenDebt(borrower), debt, "Debt not reduced");

        // Ensure HF actually improved
        assertTrue(
            pool.HealthFactor(borrower) > 0.935e18,
            "Solvency did not improve"
        );
    }
    // --- TARGET 2: FORCE VAULT RESET ---
    function test_ForceDailyLimitReset() public {
        vm.startPrank(borrower);
        pool.deposit{value: 100 ether}();

        // 1. Exhaust the limit (10,000)
        pool.borrow(10_000e18);

        // 2. Try to borrow 1 more (Should Fail)
        vm.expectRevert("Daily mint limit exceeded");
        pool.borrow(1e18);

        // 3. TIME WARP (The Trigger)
        vm.warp(block.timestamp + 1 days + 1 seconds);

        // --- FIX: HEARTBEAT ORACLE TO PREVENT STALE PRICE ---
        vm.stopPrank();
        vm.prank(admin);
        oracle.setPrice(2000e8);
        vm.startPrank(borrower);
        // ----------------------------------------------------

        // 4. Borrow again (Should Succeed & Trigger Reset)
        pool.borrow(1e18);

        vm.stopPrank();

        // Limit should be 1e18 now (reset to 0 then added 1e18)
        assertEq(vault.dailyMinted(), 1e18, "Limit did not reset");
    }

    // --- TARGET 3: HEALTH FACTOR ACCURACY ---
    function testFuzz_HealthFactorMath(uint256 price) public {
        price = bound(price, 100e8, 10_000e8);

        vm.startPrank(borrower);
        pool.deposit{value: 1 ether}();
        pool.borrow(100e18);
        vm.stopPrank();

        // --- FIX: USE PRANK FOR ORACLE ---
        vm.prank(admin);
        oracle.setPrice(price);
        // ---------------------------------

        uint256 actualHF = pool.HealthFactor(borrower);

        uint256 price18 = price * 1e10;
        uint256 expectedHF = (1 ether * price18 * 85) / (100 * 100e18);

        assertEq(actualHF, expectedHF, "HF Math Incorrect");
    }
}
