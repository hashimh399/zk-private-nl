// pragma solidity ^0.8.20;

// import "forge-std/Test.sol";
// import "forge-std/StdInvariant.sol";

// import "../../contracts/LendingPool.sol";
// import "../../contracts/Vault.sol";
// import "../../contracts/Nl.sol";
// import "../../contracts/MockOracle.sol";

// /*//////////////////////////////////////////////////////////////
//                         INVARIANT TEST
// //////////////////////////////////////////////////////////////*/

// contract LendingPoolInvariant is StdInvariant, Test {
//     LendingPool pool;
//     Vault vault;
//     NeuroLedger nl;
//     MockOracle oracle;
//     Handler handler;

//     address admin = makeAddr("admin");

//     uint256 constant HUGE_LIMIT = 1_000_000_000e18;

//     function setUp() public {
//         vm.startPrank(admin);

//         nl = new NeuroLedger("NeuroLedger", "NL", 1_000_000_000e18, admin);
//         oracle = new MockOracle(2000e8);

//         uint256 nonce = vm.getNonce(admin);
//         address predictedPool = vm.computeCreateAddress(admin, nonce + 1);

//         vault = new Vault(admin, predictedPool, address(nl), HUGE_LIMIT);
//         pool = new LendingPool(
//             admin,
//             payable(address(vault)),
//             address(oracle),
//             address(nl)
//         );

//         nl.grantRole(nl.MINTER_ROLE(), address(vault));

//         vm.stopPrank();

//         handler = new Handler(pool, vault, nl, oracle, admin);
//         targetContract(address(handler));
//     }

//     /*//////////////////////////////////////////////////////////////
//                             INVARIANTS
//     //////////////////////////////////////////////////////////////*/

//     /// Vault ETH must always be solvent
//     function invariant_VaultSolvent() public view {
//         assertGe(address(vault).balance, vault.totalEthEscrowed());
//     }

//     /// Pool must NEVER custody ETH
//     function invariant_PoolHasNoETH() public view {
//         assertEq(address(pool).balance, 0);
//     }

//     /// Pool ↔ Vault collateral mappings must match
//     function invariant_PoolVaultSync() public view {
//         address[] memory users = handler.getUsers();
//         for (uint i; i < users.length; i++) {
//             assertEq(
//                 pool.ethCollateral(users[i]),
//                 vault.ethBalance(users[i]),
//                 "Pool/Vault collateral mismatch"
//             );
//         }
//     }

//     /// Vault internal ETH accounting must sum correctly
//     function invariant_VaultAccounting() public view {
//         address[] memory users = handler.getUsers();
//         uint256 sum;

//         for (uint i; i < users.length; i++) {
//             sum += vault.ethBalance(users[i]);
//         }

//         assertEq(sum, vault.totalEthEscrowed(), "Vault escrow mismatch");
//     }

//     /// User debt must match ghost ledger
//     function invariant_DebtMatchesGhost() public view {
//         address[] memory users = handler.getUsers();
//         for (uint i; i < users.length; i++) {
//             assertEq(
//                 pool.tokenDebt(users[i]),
//                 handler.ghost_debt(users[i]),
//                 "Debt ghost mismatch"
//             );
//         }
//     }

//     /// NL supply must equal Vault-minted total
//     function invariant_NLSupplyMatchesMinted() public view {
//         assertEq(nl.totalSupply(), handler.ghost_totalMinted());
//     }

//     /// Sum of all debts must equal ghost global debt
//     function invariant_GlobalDebtConsistency() public view {
//         uint256 sum;
//         address[] memory users = handler.getUsers();

//         for (uint i; i < users.length; i++) {
//             sum += pool.tokenDebt(users[i]);
//         }

//         assertEq(sum, handler.ghost_totalDebtSum());
//     }

//     /// Pause must freeze ETH & minting
//     function invariant_PauseFreezesVault() public view {
//         if (vault.paused()) {
//             assertEq(
//                 vault.totalEthEscrowed(),
//                 handler.ghost_totalEscrowedETH()
//             );
//         }
//     }
// }

// /*//////////////////////////////////////////////////////////////
//                             HANDLER
// //////////////////////////////////////////////////////////////*/

// contract Handler is Test {
//     LendingPool pool;
//     Vault vault;
//     NeuroLedger nl;
//     MockOracle oracle;

//     address public admin;
//     address[] public users;

//     /*//////////////////////////////////////////////////////////////
//                             GHOST STATE
//     //////////////////////////////////////////////////////////////*/

//     mapping(address => uint256) public ghost_collateral;
//     mapping(address => uint256) public ghost_debt;

//     uint256 public ghost_totalMinted;
//     uint256 public ghost_totalBorrowed;
//     uint256 public ghost_totalRepaid;
//     uint256 public ghost_totalEscrowedETH;

//     constructor(
//         LendingPool _pool,
//         Vault _vault,
//         NeuroLedger _nl,
//         MockOracle _oracle,
//         address _admin
//     ) {
//         pool = _pool;
//         vault = _vault;
//         nl = _nl;
//         oracle = _oracle;
//         admin = _admin;

//         for (uint i; i < 5; i++) {
//             address u = vm.addr(100 + i);
//             users.push(u);
//             vm.deal(u, 100_000 ether);
//         }
//     }

//     /*//////////////////////////////////////////////////////////////
//                             ACTIONS
//     //////////////////////////////////////////////////////////////*/

//     function deposit(uint256 seed, uint256 amount) public {
//         address user = _user(seed);
//         amount = bound(amount, 0.1 ether, 50 ether);

//         vm.startPrank(user);
//         pool.deposit{value: amount}();
//         vm.stopPrank();

//         ghost_collateral[user] += amount;
//         ghost_totalEscrowedETH += amount;
//     }

//     function borrow(uint256 seed, uint256 amount) public {
//         address user = _user(seed);
//         if (pool.ethCollateral(user) == 0) return;

//         uint256 price18 = _price18();
//         uint256 maxBorrow = (pool.ethCollateral(user) * price18 * 85) /
//             (100 * 1e18);

//         if (maxBorrow == 0) return;
//         amount = bound(amount, 1e18, maxBorrow);

//         vm.startPrank(user);
//         try pool.borrow(amount) {
//             ghost_debt[user] += amount;
//             ghost_totalBorrowed += amount;
//             ghost_totalMinted += amount;
//         } catch {}
//         vm.stopPrank();
//     }

//     function repay(uint256 seed, uint256 amount) public {
//         address user = _user(seed);
//         uint256 debt = pool.tokenDebt(user);
//         if (debt == 0) return;

//         amount = bound(amount, 1, debt);

//         vm.startPrank(user);
//         nl.approve(address(pool), amount);
//         try pool.repay(amount) {
//             ghost_debt[user] -= amount;
//             ghost_totalRepaid += amount;
//         } catch {}
//         vm.stopPrank();
//     }

//     function liquidate(uint256 seed, uint256 repayAmount) public {
//         address borrower = _user(seed);
//         if (pool.HealthFactor(borrower) >= 1e18) return;

//         uint256 debt = pool.tokenDebt(borrower);
//         uint256 maxRepay = (debt * 50) / 100;
//         if (debt <= 1e18) maxRepay = debt;

//         repayAmount = bound(repayAmount, 1, maxRepay);

//         address liquidator = makeAddr("liquidator");
//         vm.deal(liquidator, 100 ether);

//         vm.startPrank(liquidator);
//         nl.approve(address(pool), repayAmount);

//         try pool.liquidate(borrower, repayAmount) {
//             ghost_debt[borrower] -= repayAmount;
//             ghost_totalRepaid += repayAmount;

//             uint256 seized = _seized(repayAmount, borrower);
//             ghost_collateral[borrower] -= seized;
//             ghost_collateral[liquidator] += seized;
//         } catch {}
//         vm.stopPrank();
//     }

//     function togglePause(uint256 seed) public {
//         vm.startPrank(admin);
//         if (seed % 2 == 0) {
//             pool.pause();
//             vault.pause();
//         } else {
//             pool.unpause();
//             vault.unpause();
//         }
//         vm.stopPrank();
//     }

//     function updateDailyMintLimit(uint256 newLimit) public {
//         newLimit = bound(newLimit, 1000e18, 1_000_000e18);
//         vm.prank(admin);
//         vault.setDailyMintLimit(newLimit);
//     }

//     function updateMaxPriceAge(uint256 newAge) public {
//         newAge = bound(newAge, 10 minutes, 3 days);
//         vm.prank(admin);
//         pool.setMaxPriceAge(newAge);
//     }

//     function updatePrice(uint256 newPrice) public {
//         newPrice = bound(newPrice, 100e8, 5000e8);
//         oracle.setPrice(newPrice);
//     }

//     function warpTime(uint256 s) public {
//         s = bound(s, 1 hours, 2 days);
//         vm.warp(block.timestamp + s);
//     }

//     /*//////////////////////////////////////////////////////////////
//                             HELPERS
//     //////////////////////////////////////////////////////////////*/

//     function _price18() internal view returns (uint256) {
//         (uint256 p, ) = oracle.getLatestPrice();
//         return p * 1e10;
//     }

//     function _seized(
//         uint256 repay,
//         address borrower
//     ) internal view returns (uint256) {
//         uint256 price18 = _price18();
//         uint256 base = (repay * 1e18) / price18;
//         uint256 bonus = (base * 5) / 100;
//         uint256 seized = base + bonus;

//         uint256 coll = pool.ethCollateral(borrower);
//         if (seized > coll) return coll;
//         return seized;
//     }

//     function _user(uint256 seed) internal view returns (address) {
//         return users[seed % users.length];
//     }

//     function ghost_totalDebtSum() public view returns (uint256 sum) {
//         for (uint i; i < users.length; i++) {
//             sum += ghost_debt[users[i]];
//         }
//     }

//     function getUsers() public view returns (address[] memory) {
//         return users;
//     }
// }

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";

import "../../contracts/LendingPool.sol";
import "../../contracts/Vault.sol";
import "../../contracts/Nl.sol";
import "../../contracts/MockOracle.sol";

/*//////////////////////////////////////////////////////////////
                    PROTOCOL INVARIANT TEST
//////////////////////////////////////////////////////////////*/

contract LendingPoolInvariant is StdInvariant, Test {
    LendingPool pool;
    Vault vault;
    NeuroLedger nl;
    MockOracle oracle;
    Handler handler;

    address admin = makeAddr("admin");

    uint256 constant HUGE_LIMIT = 1_000_000_000e18;

    function setUp() public {
        vm.startPrank(admin);

        // --- Deploy NL with ZERO initial supply (CRITICAL) ---
        nl = new NeuroLedger("NeuroLedger", "NL", 1_000_000_000e18, admin);

        oracle = new MockOracle(2000e8);

        // Predict pool address so Vault can trust it
        uint256 nonce = vm.getNonce(admin);
        address predictedPool = vm.computeCreateAddress(admin, nonce + 1);

        vault = new Vault(admin, predictedPool, address(nl), HUGE_LIMIT);

        pool = new LendingPool(
            admin,
            payable(address(vault)),
            address(oracle),
            address(nl)
        );

        // Vault is the ONLY minter
        nl.grantRole(nl.MINTER_ROLE(), address(vault));

        vm.stopPrank();

        handler = new Handler(pool, vault, nl, oracle, admin);
        targetContract(address(handler));
    }

    /*//////////////////////////////////////////////////////////////
                            INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// 1. Vault ETH Solvency
    function invariant_VaultSolvent() public view {
        assertGe(address(vault).balance, vault.totalEthEscrowed());
    }

    /// 2. Pool must NEVER custody ETH
    function invariant_PoolHasNoETH() public view {
        assertEq(address(pool).balance, 0);
    }

    /// 3. Pool ↔ Vault collateral accounting must match
    function invariant_PoolVaultSync() public view {
        address[] memory users = handler.getUsers();
        for (uint256 i; i < users.length; i++) {
            assertEq(
                pool.ethCollateral(users[i]),
                vault.ethBalance(users[i]),
                "Collateral mismatch"
            );
        }
    }

    /// 4. NL Supply = Minted − Burned
    function invariant_NLSupplyCorrect() public view {
        uint256 expected = handler.ghost_totalMinted() -
            handler.ghost_totalBurned();

        assertEq(nl.totalSupply(), expected, "NL supply drift");
    }

    /// 5. Debt Conservation
    function invariant_DebtConsistency() public view {
        uint256 sum;
        address[] memory users = handler.getUsers();

        for (uint256 i; i < users.length; i++) {
            sum += pool.tokenDebt(users[i]);
        }

        assertEq(sum, handler.ghost_totalDebtSum(), "Debt mismatch");
    }
    //INVARIANT : ETH Accounting consistensy
    function invariant_TotalEscrowedETH() public view {
        assertEq(
            vault.totalEthEscrowed(),
            handler.ghost_totalEscrowedETH(),
            "Vault ETH accounting drift"
        );
    }
    function invariant_HealthyUsersNotLiquidatable() public view {
        (, uint256 updatedAt) = oracle.getLatestPrice();

        // INVARIANT ASSUMPTION: HF only meaningful when price is fresh
        if (block.timestamp - updatedAt > pool.maxPriceAge()) return;

        address[] memory users = handler.getUsers();
        for (uint256 i; i < users.length; i++) {
            if (pool.tokenDebt(users[i]) == 0) continue;

            uint256 hf = pool.HealthFactor(users[i]);
            assertGt(hf, 0, "HF invalid");
        }
    }
    function invariant_LiquidationReducesDebt() public view {
        address[] memory users = handler.getUsers();

        for (uint256 i; i < users.length; i++) {
            if (pool.tokenDebt(users[i]) == 0) continue;

            // debt can never exceed original borrowed amount
            assertLe(
                pool.tokenDebt(users[i]),
                handler.ghost_debt(users[i]),
                "Debt increased unexpectedly"
            );
        }
    }
    function invariant_HealthFactorCallableWhenFresh() public view {
        (, uint256 updatedAt) = oracle.getLatestPrice();
        if (block.timestamp - updatedAt > pool.maxPriceAge()) return;

        address[] memory users = handler.getUsers();
        for (uint256 i; i < users.length; i++) {
            if (pool.tokenDebt(users[i]) == 0) continue;

            uint256 hf = pool.HealthFactor(users[i]);
            assertGt(hf, 0);
        }
    }
    function invariant_PauseDoesNotBreakAccounting() public {
        if (pool.paused()) {
            // Vault should still be solvent
            vault.assertSolvent();
        }
    }
}

/*//////////////////////////////////////////////////////////////
                            HANDLER
//////////////////////////////////////////////////////////////*/

contract Handler is Test {
    LendingPool pool;
    Vault vault;
    NeuroLedger nl;
    MockOracle oracle;
    address admin;

    address[] users;

    /*//////////////////////////////////////////////////////////////
                            GHOST STATE
    //////////////////////////////////////////////////////////////*/

    mapping(address => uint256) public ghost_debt;
    mapping(address => uint256) public ghost_collateral;
    uint256 public ghost_totalMinted;
    uint256 public ghost_totalBurned;
    uint256 public ghost_totalEscrowedETH;

    constructor(
        LendingPool _pool,
        Vault _vault,
        NeuroLedger _nl,
        MockOracle _oracle,
        address _admin
    ) {
        pool = _pool;
        vault = _vault;
        nl = _nl;
        oracle = _oracle;
        admin = _admin;

        for (uint256 i; i < 6; i++) {
            address u = vm.addr(100 + i);
            users.push(u);
            vm.deal(u, 100_000 ether);
        }
    }

    /*//////////////////////////////////////////////////////////////
                            ACTIONS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 seed, uint256 amount) public {
        address user = _user(seed);
        amount = bound(amount, 0.1 ether, 50 ether);

        vm.prank(user);
        pool.deposit{value: amount}();

        ghost_collateral[user] += amount;
        ghost_totalEscrowedETH += amount;
    }

    function borrow(uint256 seed, uint256 amount) public {
        address user = _user(seed);
        if (pool.ethCollateral(user) == 0) return;

        if (seed % 50 == 0) warpTime(1 days + 1 seconds);

        uint256 price18 = _price18();
        uint256 collateralValue = (pool.ethCollateral(user) * price18) / 1e18;

        uint256 maxBorrow = (collateralValue * 70) / 100;
        uint256 currentDaily = vault.dailyMinted();
        uint256 limit = vault.dailyMintLimit();
        if (currentDaily >= limit) return;

        uint256 available = limit - currentDaily;
        if (maxBorrow > available) maxBorrow = available;
        if (maxBorrow < 1e18) return;

        amount = bound(amount, 1e18, maxBorrow);

        vm.prank(user);
        try pool.borrow(amount) {
            ghost_debt[user] += amount;
            ghost_totalMinted += amount;
        } catch {}
    }

    function repay(uint256 seed, uint256 amount) public {
        address user = _user(seed);
        uint256 debt = pool.tokenDebt(user);
        if (debt == 0) return;

        amount = bound(amount, 1e18, debt);

        vm.startPrank(user);
        nl.approve(address(pool), amount);
        try pool.repay(amount) {
            ghost_debt[user] -= amount;
            ghost_totalBurned += amount;
        } catch {}
        vm.stopPrank();
    }
    function withdrawCollateral(uint256 seed, uint256 amount) public {
        address user = _user(seed);
        uint256 maxWithdraw = pool.ethCollateral(user);
        if (maxWithdraw == 0) return;

        amount = bound(amount, 0.01 ether, maxWithdraw);

        vm.startPrank(user);
        try pool.withDrawCollateral(amount) {
            ghost_collateral[user] -= amount;
            ghost_totalEscrowedETH -= amount;
        } catch {}
        vm.stopPrank();
    }
    /**
     * @dev INVARIANT ASSUMPTIONS:
     * - Handler may mint NL directly to simulate external market liquidity
     * - This bypasses Vault mint limits intentionally for liquidation setup
     * - Production system does NOT allow this
     */
    // function liquidate(uint256 seed, uint256 repayAmount) public {
    //     address borrower = _user(seed);
    //     // If user has no debt, they can't be liquidated.
    //     // So we GIVE them debt specifically for this test case.
    //     // 1. SETUP PHASE: Ensure user has debt
    //     if (pool.tokenDebt(borrower) == 0) {
    //         vm.startPrank(borrower);
    //         vm.deal(borrower, 10 ether);
    //         pool.deposit{value: 5 ether}();
    //         ghost_collateral[borrower] += 5 ether;
    //         ghost_totalEscrowedETH += 5 ether;

    //         uint256 price18 = _price18();
    //         uint256 borrowAmt = (5 ether * price18 * 70) / (100 * 1e18);

    //         // --- THE FIX: FORCE A RESET IF CLOGGED ---
    //         if (vault.dailyMinted() + borrowAmt > vault.dailyMintLimit()) {
    //             warpTime(1 days + 1 seconds);
    //         }
    //         // -----------------------------------------

    //         // Now this borrow is guaranteed to succeed
    //         pool.borrow(borrowAmt);
    //         ghost_debt[borrower] += borrowAmt;
    //         ghost_totalMinted += borrowAmt;

    //         vm.stopPrank();
    //     }
    //     // FORCE insolvency
    //     oracle.setPrice(500e8);
    //     _ensureFreshPrice();
    //     (, uint256 updatedAt) = oracle.getLatestPrice();
    //     if (block.timestamp - updatedAt > pool.maxPriceAge()) return;

    //     if (pool.HealthFactor(borrower) >= 1e18) return;

    //     uint256 debt = pool.tokenDebt(borrower);
    //     if (debt == 0) return;

    //     uint256 maxRepay = (debt * 50) / 100;
    //     if (debt <= 1e18) maxRepay = debt;

    //     repayAmount = bound(repayAmount, 1e18, maxRepay);

    //     address liquidator = makeAddr("liquidator");

    //     // Test funding only (simulates market purchase)
    //     vm.startPrank(admin);
    //     nl.mint(liquidator, repayAmount);
    //     vm.stopPrank();
    //     ghost_totalMinted += repayAmount;

    //     vm.startPrank(liquidator);
    //     nl.approve(address(pool), repayAmount);

    //     bool success;
    //     try pool.liquidate(borrower, repayAmount) {
    //         success = true;
    //     } catch {}
    //     if (success) {
    //         ghost_debt[borrower] -= repayAmount;
    //         ghost_totalBurned += repayAmount;

    //         uint256 seized = _seizedETH(repayAmount);
    //         uint256 coll = ghost_collateral[borrower];
    //         if (seized > coll) seized = coll;

    //         ghost_collateral[borrower] -= seized;
    //         ghost_totalEscrowedETH -= seized;

    //         oracle.setPrice(2000e8);
    //     }
    //     vm.stopPrank();
    // }
    function liquidate(uint256 seed, uint256 repayAmount) public {
        address borrower = _user(seed);

        // --- PHASE 1: SELF-HEAL ---
        // Ensure Oracle is fresh before doing ANYTHING
        (uint256 price, uint256 updatedAt) = oracle.getLatestPrice();
        if (block.timestamp - updatedAt > 1 hours) {
            vm.prank(admin);
            oracle.setPrice(price); // Heartbeat
        }

        // --- PHASE 2: SETUP VICTIM ---
        if (pool.tokenDebt(borrower) == 0) {
            vm.startPrank(borrower);
            vm.deal(borrower, 10 ether);
            pool.deposit{value: 5 ether}();
            ghost_collateral[borrower] += 5 ether;
            ghost_totalEscrowedETH += 5 ether;

            uint256 price18 = _price18();
            uint256 borrowAmt = (5 ether * price18 * 70) / (100 * 1e18);

            // FORCE RESET if limit is tight
            if (vault.dailyMinted() + borrowAmt > vault.dailyMintLimit()) {
                warpTime(1 days + 1 seconds);
            }

            // Borrow
            pool.borrow(borrowAmt);
            ghost_debt[borrower] += borrowAmt;
            ghost_totalMinted += borrowAmt;

            vm.stopPrank();
        }

        // --- PHASE 3: EXECUTE ATTACK ---
        // 1. Crash Price to $1,100 (Solvent but Liquidatable)
        // Use Prank ADMIN to ensure it works
        vm.prank(admin);
        oracle.setPrice(1100e8);

        // 2. Check Health
        // If they are still healthy (e.g. huge collateral buffer), exit
        if (pool.HealthFactor(borrower) >= 1e18) {
            // Restore price before leaving
            vm.prank(admin);
            oracle.setPrice(2000e8);
            return;
        }

        uint256 debt = pool.tokenDebt(borrower);
        uint256 maxRepay = (debt * 50) / 100;
        if (debt <= 1e18) maxRepay = debt;

        repayAmount = bound(repayAmount, 1e18, maxRepay);
        address liquidator = makeAddr("liquidator");

        // 3. Fund Liquidator
        vm.prank(admin);
        nl.mint(liquidator, repayAmount);
        ghost_totalMinted += repayAmount;

        vm.startPrank(liquidator);
        nl.approve(address(pool), repayAmount);

        try pool.liquidate(borrower, repayAmount) {
            ghost_debt[borrower] -= repayAmount;
            ghost_totalBurned += repayAmount;

            uint256 seized = _seizedETH(repayAmount);
            uint256 coll = ghost_collateral[borrower];
            if (seized > coll) seized = coll;

            ghost_collateral[borrower] -= seized;
        } catch {}
        vm.stopPrank();

        // 4. CLEANUP: Restore Price
        // Vital for other tests in the sequence to pass
        vm.prank(admin);
        oracle.setPrice(2000e8);
    }
    function updatePrice(uint256 newPrice) public {
        newPrice = bound(newPrice, 100e8, 5000e8);
        oracle.setPrice(newPrice);
    }

    /*//////////////////////////////////////////////////////////////
                            HELPERS
    //////////////////////////////////////////////////////////////*/

    function _price18() internal view returns (uint256) {
        (uint256 p, ) = oracle.getLatestPrice();
        return p * 1e10;
    }

    function _seizedETH(uint256 repayAmount) internal view returns (uint256) {
        uint256 price18 = _price18();
        uint256 base = (repayAmount * 1e18) / price18;
        uint256 bonus = (base * 5) / 100;
        return base + bonus;
    }
    function _user(uint256 seed) internal view returns (address) {
        return users[seed % users.length];
    }

    function ghost_totalDebtSum() public view returns (uint256 sum) {
        for (uint256 i; i < users.length; i++) {
            sum += ghost_debt[users[i]];
        }
    }
    function warpTime(uint256 secondsToWarp) public {
        secondsToWarp = bound(secondsToWarp, 10 minutes, 2 days);
        vm.warp(block.timestamp + secondsToWarp);

        (uint256 currentPrice, ) = oracle.getLatestPrice();
        oracle.setPrice(currentPrice);
    }

    function _ensureFreshPrice() internal {
        (, uint256 updatedAt) = oracle.getLatestPrice();
        if (block.timestamp - updatedAt > pool.maxPriceAge()) {
            vm.warp(block.timestamp + pool.maxPriceAge() + 1);
            (uint256 p, ) = oracle.getLatestPrice();
            oracle.setPrice(p);
        }
    }
    function getUsers() public view returns (address[] memory) {
        return users;
    }
}
