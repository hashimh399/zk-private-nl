import { expect } from "chai";
import { ethers } from "hardhat";
//next improvement make exoectations slightly strucker .to.be.revertedWithCustomError || revertedWith
describe("NeuroLedger", function () {
  let token: any;
  let admin: any;
  let user: any;

  const CAP = ethers.parseEther("1000000");
  beforeEach(async () => {
    [admin, user] = await ethers.getSigners();
    const NL = await ethers.getContractFactory("NeuroLedger");
    token = await NL.deploy("NeuroLedger", "NL", CAP, admin.address);
  });
  describe("Roles", function () {});

  describe("Minting", function () {
    it("reverts if non minter tries to mint", async () => {
      const amount = ethers.parseEther("100");
      await expect(token.connect(user).mint(user.address, amount)).to.be
        .reverted;
    });

    it("allows minter to mint", async () => {
      const amount = ethers.parseEther("100");
      await token.connect(admin).mint(user.address, amount);

      expect(await token.balanceOf(user.address)).to.equal(amount);
    });

    it("Reverts when minting exceeds cap", async () => {
      await token.connect(admin).mint(admin.address, CAP);
      await expect(token.connect(admin).mint(admin.address, 1)).to.be.reverted;
    });
    it("blocks minting when paused", async () => {
      const amount = ethers.parseEther("10");

      await token.connect(admin).pause();

      await expect(token.connect(admin).mint(user.address, amount)).to.be
        .reverted;
    });
  });

  describe("Pause", function () {
    it("blocks transfers when paused", async () => {
      const amount = ethers.parseEther("10");
      await token.connect(admin).mint(admin.address, amount);
      await token.connect(admin).pause();

      await expect(token.transfer(user.address, amount)).to.be.reverted;
    });

    it("allows tranesfers when unpaused", async () => {
      const amount = ethers.parseEther("10");
      await token.connect(admin).mint(admin.address, amount);

      await token.connect(admin).pause();
      await token.connect(admin).unpause();

      await token.transfer(user.address, amount);
      expect(await token.balanceOf(user.address)).to.equal(amount);
    });
  });

  describe("Burning", function () {
    it("allows holder to burn own tokens", async () => {
      const amount = ethers.parseEther("50");
      await token.connect(admin).mint(user.address, amount);

      await token.connect(user).burn(amount);

      expect(await token.totalSupply()).to.equal(0);
    });
  });
  describe("Permit / Nonces", function () {});
});
