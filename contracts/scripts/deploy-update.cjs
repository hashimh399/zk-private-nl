/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const ADMIN = deployer.address;

  // 1) Load existing deployments
  const outPath = path.join(__dirname, "..", "deployments", "sepolia.json");
  if (!fs.existsSync(outPath)) {
    throw new Error(`Deployment file not found at ${outPath}`);
  }
  const deployments = JSON.parse(fs.readFileSync(outPath, "utf8"));

  const {
    LendingPool: oldPoolAddress, // We need this to revoke its permissions!
    NL: nlAddress,
    Vault: vaultAddress,
    MockOracle: oracleAddress,
    Groth16Verifier: verifierAddress,
    BorrowApprovalRegistry: registryAddress,
    forwarder: FORWARDER,
    root: INITIAL_ROOT
  } = deployments;

  if (!FORWARDER) throw new Error("FORWARDER address missing from sepolia.json");

  console.log("--- Loaded Existing Infrastructure ---");
  console.log("Vault:", vaultAddress);
  console.log("Oracle:", oracleAddress);
  console.log("NL Token:", nlAddress);

  // === 2) Deploy NEW LendingPool ===
  console.log("\n--- Deploying New Contracts ---");
  const Pool = await ethers.getContractFactory("contracts/LendingPool.sol:LendingPool");
  const newPool = await Pool.deploy(ADMIN, vaultAddress, oracleAddress, nlAddress);
  await newPool.waitForDeployment();
  console.log("🆕 New LendingPool deployed to:", newPool.target);

  // === 3) Deploy NEW CRELiquidationReceiver ===
  const Receiver = await ethers.getContractFactory("CRELiquidationReceiver");
  const newReceiver = await Receiver.deploy(ADMIN, newPool.target, FORWARDER);
  await newReceiver.waitForDeployment();
  console.log("🆕 New CRELiquidationReceiver deployed to:", newReceiver.target);

  // === 4) Deploy NEW BorrowGate ===
  const Gate = await ethers.getContractFactory("BorrowGate");
  const newGate = await Gate.deploy(ADMIN, newPool.target, registryAddress, verifierAddress, INITIAL_ROOT);
  await newGate.waitForDeployment();
  console.log("🆕 New BorrowGate deployed to:", newGate.target);

  // === 5) Wire Everything Together (The Crucial Part) ===
  console.log("\n--- Wiring Roles & Permissions ---");

  // A. Link the Pool to the Receiver and Gate
  let tx = await newPool.setCRELiquidationReceiver(newReceiver.target);
  await tx.wait();
  console.log("✅ LendingPool.setCRELiquidationReceiver -> ok");

  tx = await newPool.setBorrowGate(newGate.target);
  await tx.wait();
  console.log("✅ LendingPool.setBorrowGate -> ok");

  // B. Vault Permissions
  const Vault = await ethers.getContractAt("Vault", vaultAddress);
  const POOL_ROLE = await Vault.POOL_ROLE();

  // Grant Vault access to the NEW pool
  tx = await Vault.grantRole(POOL_ROLE, newPool.target);
  await tx.wait();
  console.log("✅ Vault.grantRole(POOL_ROLE, New LendingPool) -> ok");

  // Revoke Vault access from the OLD pool (Security Hygiene)
  if (oldPoolAddress) {
    tx = await Vault.revokeRole(POOL_ROLE, oldPoolAddress);
    await tx.wait();
    console.log(`🔒 Vault.revokeRole(POOL_ROLE, Old LendingPool) -> ok`);
  }

  // === 6) Save updated deployments ===
  deployments.LendingPool = newPool.target;
  deployments.CRELiquidationReceiver = newReceiver.target;
  deployments.BorrowGate = newGate.target;
  deployments.timestamp = new Date().toISOString();

  fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2));
  console.log(`\n🎉 Successfully updated ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});