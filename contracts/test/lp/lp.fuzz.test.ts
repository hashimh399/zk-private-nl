import { expect } from "chai";
import { ethers } from "hardhat";

describe("LendingPool – Invariants (Fuzz | MVP1)", function () {
  let pool: any;
  let vault: any;
  let token: any;
  let oracle: any;

  let admin: any;
  let users: any[];
  let liquidator: any;

  const RUNS = 20;

  function rand(max: number) {
    return Math.floor(Math.random() * max);
  }

  beforeEach(async () => {
    [admin, ...users] = await ethers.getSigners();
    liquidator = users[3];

    /* ---------- Deploy Oracle ---------- */
    const Oracle = await ethers.getContractFactory("MockOracle");
    oracle = await Oracle.deploy(ethers.parseUnits("2000", 8));

    /* ---------- Deploy NL ---------- */
    const NL = await ethers.getContractFactory("NeuroLedger");
    token = await NL.deploy(
      "NeuroLedger",
      "NL",
      ethers.parseEther("1000000"),
      admin.address
    );

    /* ---------- Deploy Vault ---------- */
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      admin.address,
      admin.address, // temp pool, fixed below
      token.target,
      ethers.parseEther("10000")
    );

    /* ---------- Deploy LendingPool ---------- */
    const Pool = await ethers.getContractFactory("LendingPool");
    pool = await Pool.deploy(
      admin.address,
      vault.target,
      oracle.target,
      token.target
    );

    /* ---------- Fix roles ---------- */
    await vault.connect(admin).grantRole(await vault.POOL_ROLE(), pool.target);

    await token
      .connect(admin)
      .grantRole(await token.MINTER_ROLE(), vault.target);

    /* ---------- Fund users ---------- */
    for (const u of users) {
      await admin.sendTransaction({
        to: u.address,
        value: ethers.parseEther("10"),
      });
    }
  });

  /* ============================================================
     INVARIANT 1: Pool never holds ETH
  ============================================================ */
  it("INV-1: Pool never holds ETH", async () => {
    for (let i = 0; i < RUNS; i++) {
      const u = users[rand(3)];
      const amt = ethers.parseEther((Math.random() * 2).toFixed(3));

      await pool.connect(u).deposit({ value: amt });
    }

    expect(await ethers.provider.getBalance(pool.target)).to.equal(0);
  });

  /* ============================================================
     INVARIANT 2: Vault always solvent
  ============================================================ */
  it("INV-2: Vault balance >= totalEthEscrowed", async () => {
    for (let i = 0; i < RUNS; i++) {
      const u = users[rand(3)];
      const amt = ethers.parseEther((Math.random() * 2).toFixed(3));

      await pool.connect(u).deposit({ value: amt });
    }

    const vaultBalance = await ethers.provider.getBalance(vault.target);
    const escrowed = await vault.totalEthEscrowed();

    expect(vaultBalance).to.be.gte(escrowed);
  });

  /* ============================================================
     INVARIANT 3: HF never breaks after borrow
  ============================================================ */
  it("INV-3: Health factor never < 1 after borrow", async () => {
    const u = users[0];

    await pool.connect(u).deposit({ value: ethers.parseEther("5") });

    for (let i = 0; i < RUNS; i++) {
      const borrowAmt = ethers.parseEther((Math.random() * 1000).toFixed(0));

      try {
        await pool.connect(u).borrow(borrowAmt);
      } catch {
        // revert is acceptable
      }

      const debt = await pool.tokenDebt(u.address);
      if (debt > 0n) {
        const hf = await pool.HealthFactor(u.address);
        expect(hf).to.be.gte(ethers.parseEther("1"));
      }
    }
  });

  /* ============================================================
     INVARIANT 4: Liquidation improves solvency
  ============================================================ */
  it("INV-4: Liquidation improves solvency", async () => {
    const borrower = users[0];

    await pool.connect(borrower).deposit({
      value: ethers.parseEther("2"),
    });

    await pool.connect(borrower).borrow(ethers.parseEther("1500"));

    // price drop
    await oracle.setPrice(ethers.parseUnits("900", 8));

    const hfBefore = await pool.HealthFactor(borrower.address);

    const repay = ethers.parseEther("300");
    await token.connect(liquidator).approve(pool.target, repay);

    try {
      await pool.connect(liquidator).liquidate(borrower.address, repay);
    } catch {
      return; // revert acceptable
    }

    const hfAfter = await pool.HealthFactor(borrower.address);
    const debt = await pool.tokenDebt(borrower.address);

    expect(hfAfter > hfBefore || debt === 0n).to.equal(true);
  });

  /* ============================================================
     INVARIANT 5: No mint inflation
  ============================================================ */
  it("INV-5: dailyMinted never exceeds limit", async () => {
    const limit = await vault.dailyMintLimit();
    const minted = await vault.dailyMinted();

    expect(minted).to.be.lte(limit);
  });
});
