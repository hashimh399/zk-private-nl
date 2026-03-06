import { expect } from "chai";
import { ethers } from "hardhat";

describe("LendingPool (MVP1)", function () {
  let admin: any, user: any, liquidator: any;
  let vault: any, pool: any, token: any, oracle: any;

  const PRICE = ethers.parseUnits("2000", 8); // $2000 ETH
  const ONE_ETH = ethers.parseEther("1");
  const ONE_NL = ethers.parseEther("1");

  beforeEach(async () => {
    [admin, user, liquidator] = await ethers.getSigners();

    // Deploy NL
    const NL = await ethers.getContractFactory("NeuroLedger");
    token = await NL.deploy(
      "NeuroLedger",
      "NL",
      ONE_NL * 1_000_000n,
      admin.address
    );

    // Deploy Oracle
    const Oracle = await ethers.getContractFactory("MockOracle");
    oracle = await Oracle.deploy(PRICE);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      admin.address,
      admin.address, // temp pool, updated later
      token.target,
      ethers.parseEther("100000")
    );

    // Deploy LendingPool
    const Pool = await ethers.getContractFactory("LendingPool");
    pool = await Pool.deploy(
      admin.address,
      vault.target,
      oracle.target,
      token.target
    );

    // Fix roles
    await vault.connect(admin).grantRole(await vault.POOL_ROLE(), pool.target);

    await token
      .connect(admin)
      .grantRole(await token.MINTER_ROLE(), vault.target);
  });

  /* ================== DEPOSIT ================== */

  it("user can deposit ETH and pool holds no ETH", async () => {
    await pool.connect(user).deposit({ value: ONE_ETH });

    expect(await pool.ethCollateral(user.address)).to.equal(ONE_ETH);
    expect(await ethers.provider.getBalance(pool.target)).to.equal(0);
  });

  /* ================== BORROW ================== */

  it("borrow fails without collateral", async () => {
    await expect(pool.connect(user).borrow(ONE_NL)).to.be.reverted;
  });

  it("user can borrow within HF", async () => {
    await pool.connect(user).deposit({ value: ONE_ETH });
    await pool.connect(user).borrow(ethers.parseEther("1000"));

    expect(await token.balanceOf(user.address)).to.equal(
      ethers.parseEther("1000")
    );
  });

  /* ================== WITHDRAW ================== */

  it("withdraw blocked if HF would break", async () => {
    await pool.connect(user).deposit({ value: ONE_ETH });
    await pool.connect(user).borrow(ethers.parseEther("1000"));

    await expect(pool.connect(user).withDrawCollateral(ONE_ETH)).to.be.reverted;
  });

  /* ================== REPAY ================== */

  it("repay reduces debt", async () => {
    await pool.connect(user).deposit({ value: ONE_ETH });
    await pool.connect(user).borrow(ONE_NL);

    await token.connect(user).approve(pool.target, ONE_NL);
    await pool.connect(user).repay(ONE_NL);

    const [, debt] = await pool.getAccountInfo(user.address);
    expect(debt).to.equal(0);
  });

  /* ================== LIQUIDATION ================== */
  //“We explicitly require liquidation to improve health factor or fully close the position. This prevents uneconomical liquidations, gas griefing, and oracle edge exploits.”
  it("liquidation improves solvency", async () => {
    await pool.connect(user).deposit({ value: ONE_ETH });
    await pool.connect(user).borrow(ethers.parseEther("1500"));

    // ETH price drops
    await oracle.setPrice(ethers.parseUnits("1000", 8));
    const repay = await ethers.parseEther("500");
    await token.connect(liquidator).approve(pool.target, repay);

    await expect(
      pool.connect(liquidator).liquidate(user.address, repay)
    ).to.emit(pool, "Liquidation");
  });

  /* ================== ORACLE SAFETY ================== */

  it("reverts on stale oracle price", async () => {
    await ethers.provider.send("evm_increaseTime", [7200]);
    await ethers.provider.send("evm_mine", []);

    await expect(pool.collateralValueOf(user.address)).to.be.reverted;
  });
});
