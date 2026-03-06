import { expect } from "chai";
import { ethers } from "hardhat";

describe("Vault", function () {
  let vault: any;
  let token: any;
  let admin: any;
  let pool: any;
  let userA: any;
  let userB: any;

  const DAILY_LIMIT = ethers.parseEther("1000");

  beforeEach(async () => {
    [admin, pool, userA, userB] = await ethers.getSigners();

    // Deploy NL
    const NL = await ethers.getContractFactory("NeuroLedger");
    token = await NL.deploy(
      "NeuroLedger",
      "NL",
      ethers.parseEther("1000000"),
      admin.address
    );

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      admin.address,
      pool.address,
      token.target,
      DAILY_LIMIT
    );

    // Grant MINTER_ROLE to Vault
    await token
      .connect(admin)
      .grantRole(await token.MINTER_ROLE(), vault.target);
  });

  /* ---------------- ETH ESCROW ---------------- */
  describe("ETH Escrow", function () {
    it("depositETH keeps accounting consistent", async () => {
      const amount = ethers.parseEther("1");

      await vault.connect(pool).depositETH(userA.address, { value: amount });

      expect(await vault.ethBalance(userA.address)).to.equal(amount);
      expect(await vault.totalEthEscrowed()).to.equal(amount);

      // Physical ETH check
      expect(await ethers.provider.getBalance(vault.target)).to.equal(amount);
    });

    it("transferEscrow preserves totalEthEscrowed", async () => {
      const amount = ethers.parseEther("1");

      await vault.connect(pool).depositETH(userA.address, { value: amount });

      const totalBefore = await vault.totalEthEscrowed();

      await vault
        .connect(pool)
        .transferEscrow(userA.address, userB.address, amount);

      expect(await vault.ethBalance(userA.address)).to.equal(0);
      expect(await vault.ethBalance(userB.address)).to.equal(amount);
      expect(await vault.totalEthEscrowed()).to.equal(totalBefore);
    });
  });
  describe("Access Control", function () {
    it("non-pool cannot deposit ETH", async () => {
      await expect(
        vault.connect(userA).depositETH(userA.address, {
          value: ethers.parseEther("1"),
        })
      ).to.be.reverted;
    });

    it("non-pool cannot transfer escrow", async () => {
      await expect(
        vault.connect(userA).transferEscrow(userA.address, userB.address, 1)
      ).to.be.reverted;
    });
  });

  describe("NL Minting", function () {
    it("only pool can mint NL", async () => {
      await expect(vault.connect(userA).mintNL(userA.address, 1)).to.be
        .reverted;
    });

    it("pool can mint NL within daily limit", async () => {
      const amount = ethers.parseEther("100");

      await vault.connect(pool).mintNL(userA.address, amount);

      expect(await token.balanceOf(userA.address)).to.equal(amount);
      expect(await vault.dailyMinted()).to.equal(amount);
    });

    it("reverts if daily mint limit exceeded", async () => {
      await vault.connect(pool).mintNL(userA.address, DAILY_LIMIT);

      await expect(
        vault.connect(pool).mintNL(userA.address, 1)
      ).to.be.revertedWith("Daily mint limit exceeded");
    });

    it("resets daily mint after 24 hours", async () => {
      const amount = ethers.parseEther("500");

      await vault.connect(pool).mintNL(userA.address, amount);

      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await vault.connect(pool).mintNL(userA.address, amount);

      expect(await vault.dailyMinted()).to.equal(amount);
    });
  });

  describe("Pause Safety", function () {
    it("blocks ETH withdrawals when paused", async () => {
      const amount = ethers.parseEther("1");

      await vault.connect(pool).depositETH(userA.address, { value: amount });
      await vault.connect(admin).pause();

      await expect(vault.connect(pool).withdrawETH(userA.address, amount)).to.be
        .reverted;
    });

    it("blocks minting when paused", async () => {
      await vault.connect(admin).pause();

      await expect(vault.connect(pool).mintNL(userA.address, 1)).to.be.reverted;
    });
  });

  describe("Force Send", async () => {
    it("remains solvent when ETH is force-sent", async () => {
      const amount = ethers.parseEther("1");

      await admin.sendTransaction({
        to: vault.target,
        value: amount,
      });

      // No accounting updated
      expect(await vault.totalEthEscrowed()).to.equal(0);

      // But vault is solvent
      await vault.assertSolvent();
    });
  });
});
