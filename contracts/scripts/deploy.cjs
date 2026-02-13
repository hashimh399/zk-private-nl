require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1) Deploy NL token
  const NL = await hre.ethers.getContractFactory("NeuroLedger");
  const token = await NL.deploy(
    "NeuroLedger",
    "NL",
    hre.ethers.parseEther("1000000"),
    deployer.address
  );
  await token.waitForDeployment();
  console.log("NL:", token.target);

  // 2) Deploy Oracle (price=3000, 8 decimals)
  const Oracle = await hre.ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(hre.ethers.parseUnits("3000", 8));
  await oracle.waitForDeployment();
  console.log("Oracle:", oracle.target);

  // 3) Deploy Vault (cycle fixed)
  const Vault = await hre.ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(
    deployer.address,
    token.target,
    hre.ethers.parseEther("10000")
  );
  await vault.waitForDeployment();
  console.log("Vault:", vault.target);

  // 4) Deploy LendingPool
  const Pool = await hre.ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(deployer.address, vault.target, oracle.target, token.target);
  await pool.waitForDeployment();
  console.log("Pool:", pool.target);

  // 5) Wire roles
  // Vault: allow pool to call vault methods
  await (await vault.connect(deployer).setPool(pool.target)).wait();
  console.log("Vault.setPool(pool) ✅");

  // Token: allow vault to mint
  await (await token.connect(deployer).grantRole(await token.MINTER_ROLE(), vault.target)).wait();
  console.log("Token.grantRole(MINTER_ROLE, vault) ✅");

  console.log("\n=== DEPLOYED ADDRESSES (Sepolia) ===");
  console.log("NL Token:", token.target);
  console.log("MockOracle:", oracle.target);
  console.log("Vault:", vault.target);
  console.log("LendingPool:", pool.target);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
