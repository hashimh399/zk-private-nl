require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const OUT_PATH = path.join(__dirname, "..", "deployments", "sepolia.json");

function saveJson(obj: any) {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(obj, null, 2));
}

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
    hre.ethers.parseEther("10000") // dailyMintLimit
  );
  await vault.waitForDeployment();
  console.log("Vault:", vault.target);

  // 4) Deploy LendingPool (your modified version with borrowFor + setBorrowGate)
  const Pool = await hre.ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(
    deployer.address,
    vault.target,
    oracle.target,
    token.target
  );
  await pool.waitForDeployment();
  console.log("LendingPool:", pool.target);

  // 5) Wire roles / permissions

  // Vault: allow pool to call vault methods (POOL_ROLE)
  await (await vault.connect(deployer).setPool(pool.target)).wait();
  console.log("Vault.setPool(pool) ✅");

  // Token: allow vault to mint NL
  await (await token.connect(deployer).grantRole(await token.MINTER_ROLE(), vault.target)).wait();
  console.log("Token.grantRole(MINTER_ROLE, vault) ✅");

  // 6) Deploy BorrowGate (v1 admin-approval)
  const Gate = await hre.ethers.getContractFactory("BorrowGate");
  const gate = await Gate.deploy(deployer.address, pool.target);
  await gate.waitForDeployment();
  console.log("BorrowGate:", gate.target);

  // 7) Set BorrowGate in pool (prevents bypass)
  await (await pool.connect(deployer).setBorrowGate(gate.target)).wait();
  console.log("Pool.setBorrowGate(gate) ✅");

  // 8) Persist deployments
  const deployments = {
    chain: "sepolia",
    chainId: 11155111,
    deployer: deployer.address,
    NL: token.target,
    MockOracle: oracle.target,
    Vault: vault.target,
    LendingPool: pool.target,
    BorrowGate: gate.target,
    updatedAt: new Date().toISOString()
  };

  saveJson(deployments);

  console.log("\n=== DEPLOYMENTS WRITTEN ===");
  console.log(OUT_PATH);
  console.log(deployments);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
