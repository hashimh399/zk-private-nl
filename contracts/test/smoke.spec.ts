import { expect } from "chai";
import hardhat from "hardhat";

const { ethers } = hardhat;

describe("Smoke: NeuroLedger protocol", function () {
  let admin: any;
  let alice: any;
  let liquidator: any;

  let token: any;
  let oracle: any;
  let vault: any;
  let pool: any;

  beforeEach(async () => {
    [admin, alice, liquidator] = await ethers.getSigners();

    // --- Oracle ---
    const Oracle = await ethers.getContractFactory("MockOracle");
    oracle = await Oracle.deploy(ethers.parseUnits("3000", 8)); // $3000
    await oracle.waitForDeployment?.();

    // --- NL Token ---
    const NL = await ethers.getContractFactory("NeuroLedger");
    token = await NL.deploy(
      "NeuroLedger",
      "NL",
      ethers.parseEther("1000000"),
      admin.address
    );
    await token.waitForDeployment?.();

    // --- Vault (cycle fixed) ---
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      admin.address,
      token.target,
      ethers.parseEther("10000") // dailyMintLimit
    );
    await vault.waitForDeployment?.();

    // Allow Vault to mint NL
    await token
      .connect(admin)
      .grantRole(await token.MINTER_ROLE(), vault.target);

    // --- LendingPool ---
    const Pool = await ethers.getContractFactory("LendingPool");
    pool = await Pool.deploy(admin.address, vault.target, oracle.target, token.target);
    await pool.waitForDeployment?.();

    // Allow Pool to call Vault functions
    await vault.connect(admin).setPool(pool.target);

    // Fund tx gas
    await admin.sendTransaction({ to: alice.address, value: ethers.parseEther("5") });
    await admin.sendTransaction({ to: liquidator.address, value: ethers.parseEther("5") });
  });

  it("deposit → borrow → repay works; vault solvency holds", async () => {
    const depositAmt = ethers.parseEther("1");
    await expect(pool.connect(alice).deposit({ value: depositAmt }))
      .to.emit(pool, "Deposit")
      .withArgs(alice.address, depositAmt);

    expect(await pool.ethCollateral(alice.address)).to.equal(depositAmt);
    expect(await vault.ethBalance(alice.address)).to.equal(depositAmt);

    const borrowAmt = ethers.parseEther("500");
    await expect(pool.connect(alice).borrow(borrowAmt))
      .to.emit(pool, "Borrow")
      .withArgs(alice.address, borrowAmt);

    expect(await pool.tokenDebt(alice.address)).to.equal(borrowAmt);
    expect(await token.balanceOf(alice.address)).to.equal(borrowAmt);

    const repayAmt = ethers.parseEther("200");

    // repay() calls token.transferFrom(msg.sender, vault, amount) inside LendingPool
    // spender is LendingPool => approve pool
    await token.connect(alice).approve(pool.target, repayAmt);

    await expect(pool.connect(alice).repay(repayAmt))
      .to.emit(pool, "Repay")
      .withArgs(alice.address, repayAmt);

    await expect(vault.assertSolvent()).to.not.be.reverted;
    const vaultBal = await ethers.provider.getBalance(vault.target);
    const escrowed = await vault.totalEthEscrowed();
    expect(vaultBal).to.be.gte(escrowed);
  });

  it("liquidation executes when HF < 1 and improves solvency (or clears debt)", async () => {
    // Setup borrower
    await pool.connect(alice).deposit({ value: ethers.parseEther("1") });
    await pool.connect(alice).borrow(ethers.parseEther("1200"));

    // Make liquidatable: 1 ETH collateral @ 1200 => HF ~ 0.85 (LT=85%)
    await oracle.connect(admin).setPrice(ethers.parseUnits("1200", 8));

    const hfBefore = await pool.HealthFactor(alice.address);
    expect(hfBefore).to.be.lt(ethers.parseEther("1"));

    // Fund liquidator with NL (admin has MINTER_ROLE)
    await token.connect(admin).mint(liquidator.address, ethers.parseEther("2000"));

    // Max close factor is 50% => 600 for 1200 debt
    const repayAmt = ethers.parseEther("600");
    await token.connect(liquidator).approve(pool.target, repayAmt);

    await expect(pool.connect(liquidator).liquidate(alice.address, repayAmt))
      .to.emit(pool, "Liquidation");

    const hfAfter = await pool.HealthFactor(alice.address);
    const debtAfter = await pool.tokenDebt(alice.address);
    expect(hfAfter >= hfBefore || debtAfter === 0n).to.equal(true);

    await expect(vault.assertSolvent()).to.not.be.reverted;
  });
});
