import { expect } from "chai";
import hardhat from "hardhat";
const { ethers } = hardhat;

describe("BorrowGate v1 (local)", function () {
  it("request → approve → execute results in NL mint", async () => {
    const [admin, user] = await ethers.getSigners();

    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(ethers.parseUnits("3000", 8));

    const NL = await ethers.getContractFactory("NeuroLedger");
    const token = await NL.deploy("NeuroLedger","NL",ethers.parseEther("1000000"),admin.address);

    const Vault = await ethers.getContractFactory("Vault");
    const vault = await Vault.deploy(admin.address, token.target, ethers.parseEther("10000"));

    await token.connect(admin).grantRole(await token.MINTER_ROLE(), vault.target);

    const Pool = await ethers.getContractFactory("LendingPool");
    const pool = await Pool.deploy(admin.address, vault.target, oracle.target, token.target);

    await vault.connect(admin).setPool(pool.target);

    const Gate = await ethers.getContractFactory("BorrowGate");
    const gate = await Gate.deploy(admin.address, pool.target);

    await pool.connect(admin).setBorrowGate(gate.target);

    // user deposits collateral
    await pool.connect(user).deposit({ value: ethers.parseEther("1") });

    // request borrow
    await expect(gate.connect(user).requestBorrow(ethers.parseEther("100")))
      .to.emit(gate, "BorrowRequested");

    // approve (temporary; later CRE replaces this)
    await gate.connect(admin).approveBorrow(0);

    // execute
    await gate.connect(user).executeBorrow(0);

    expect(await token.balanceOf(user.address)).to.equal(ethers.parseEther("100"));
  });
});
