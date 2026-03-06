
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../contracts/LendingPool.sol";
import "../../contracts/Vault.sol";
import "../../contracts/Nl.sol";
import "../../contracts/MockOracle.sol";

contract LendingPoolFuzzTest is Test {
    LendingPool public pool;
    Vault public vault;
    NeuroLedger public nl;
    MockOracle public oracle;

    address internal user;
    address internal admin;

    uint256 constant DAILY_LIMIT = 10_000e18;

    function setUp() public {
        admin = makeAddr("admin");
        user = makeAddr("user");

        vm.startPrank(admin);

        nl = new NeuroLedger("NeuroLedger", "NL", 1_000_000e18, admin);
        oracle = new MockOracle(2000e8);

        uint256 nonce = vm.getNonce(admin);
        address predictedPool = vm.computeCreateAddress(admin, nonce + 1);

        vault = new Vault(admin, predictedPool, address(nl), DAILY_LIMIT);
        pool = new LendingPool(
            admin,
            payable(address(vault)),
            address(oracle),
            address(nl)
        );

        nl.grantRole(nl.MINTER_ROLE(), address(vault));
        vm.stopPrank();

        vm.deal(user, 1000 ether);
    }

    /*//////////////////////////////////////////////////////////////
                                DEPOSIT
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 0.01 ether, 1000 ether);

        vm.prank(user);
        pool.deposit{value: amount}();

        assertEq(pool.ethCollateral(user), amount);
        assertEq(vault.ethBalance(user), amount);
        assertEq(address(vault).balance, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                BORROW
    //////////////////////////////////////////////////////////////*/

    function testFuzz_Borrow(uint256 collateral, uint256 borrowAmount) public {
        collateral = bound(collateral, 1 ether, 100 ether);

        uint256 price = 2000;
        uint256 maxBorrow = (collateral * price * 85) / 100;

        borrowAmount = bound(borrowAmount, 1e18, maxBorrow);
    
        vm.startPrank(user);
        pool.deposit{value: collateral}();

        try pool.borrow(borrowAmount) {
             assertEq(pool.tokenDebt(user), borrowAmount);
        assertEq(nl.balanceOf(user), borrowAmount);
        }catch{
        }
        vm.stopPrank();

       
    }

    /*//////////////////////////////////////////////////////////////
                                REPAY (BURN)
    //////////////////////////////////////////////////////////////*/

    function testFuzz_RepayBurnsSupply(uint256 repayAmount) public {
        repayAmount = bound(repayAmount, 1e18, 5000e18);

        vm.startPrank(user);
        pool.deposit{value: 50 ether}();
        pool.borrow(repayAmount);

        nl.approve(address(pool), repayAmount);
        pool.repay(repayAmount);
        vm.stopPrank();

        assertEq(pool.tokenDebt(user), 0);
        assertEq(nl.totalSupply(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                                DAILY LIMIT
    //////////////////////////////////////////////////////////////*/

    function testFuzz_DailyMintLimit(uint256 a, uint256 b) public {
        vm.prank(user);
        pool.deposit{value: 1000 ether}();

        a = bound(a, 5_000e18, DAILY_LIMIT);
        b = bound(b, 5_001e18, DAILY_LIMIT);

        vm.startPrank(user);
        pool.borrow(a);
        vm.expectRevert("Daily mint limit exceeded");
        pool.borrow(b);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                ORACLE STALE
    //////////////////////////////////////////////////////////////*/

    function testFuzz_RevertIfOracleStale(uint256 warpBy) public {
        vm.prank(user);
        pool.deposit{value: 10 ether}();

        warpBy = bound(warpBy, 3601, 30 days);
        vm.warp(block.timestamp + warpBy);

        vm.prank(user);
        vm.expectRevert("STALE PRICE");
        pool.borrow(1e18);
    }

    /*//////////////////////////////////////////////////////////////
                                ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    function testFuzz_RandomUserCannotAdmin(uint256 seed) public {
        address hacker = address(uint160(seed));
        vm.assume(hacker != admin && hacker != address(pool));

        vm.startPrank(hacker);
        vm.expectRevert();
        vault.setDailyMintLimit(1);
        vm.expectRevert();
        pool.pause();
        vm.expectRevert();
        nl.mint(hacker, 1e18);
        vm.stopPrank();
    }
}
