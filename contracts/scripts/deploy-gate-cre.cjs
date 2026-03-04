require("dotenv").config();
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const DEPLOYMENTS_PATH = path.join(__dirname, "..", "deployments", "sepolia.json");

function load() {
  return JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));
}

function save(obj) {
  fs.mkdirSync(path.dirname(DEPLOYMENTS_PATH), { recursive: true });
  fs.writeFileSync(DEPLOYMENTS_PATH, JSON.stringify(obj, null, 2));
}


// For now keep 0 and set later after Script A generates root.
const TEMP_ROOT = "0x" + "01".repeat(32);

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const dep = load();

  // Existing base contracts (already deployed)
  const token = await hre.ethers.getContractAt("NeuroLedger", dep.NL);
  const oracle = await hre.ethers.getContractAt("MockOracle", dep.MockOracle);
  const vault = await hre.ethers.getContractAt("Vault", dep.Vault);

  // 0) Deploy ZK verifier (Groth16Verifier) - NEW
  // This is your snarkjs-generated verifier contract imported into contracts.
  const Verifier = await hre.ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  dep.ZKPassVerifier = verifier.target;
  console.log("ZKPassVerifier (Groth16Verifier):", dep.ZKPassVerifier);

  // 1) Deploy NEW LendingPool (modified version)
  const Pool = await hre.ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(deployer.address, dep.Vault, dep.MockOracle, dep.NL);
  await pool.waitForDeployment();
  dep.LendingPool = pool.target;
  console.log("New LendingPool:", dep.LendingPool);

  // 2) Ensure Vault authorizes this pool (POOL_ROLE)
  const POOL_ROLE = await vault.POOL_ROLE();
  await (await vault.grantRole(POOL_ROLE, pool.target)).wait();
  console.log("Vault.grantRole(POOL_ROLE, newPool) ✅");

  // 3) Ensure Vault can mint NL
  const MINTER_ROLE = await token.MINTER_ROLE();
  const hasMinter = await token.hasRole(MINTER_ROLE, dep.Vault);
  if (!hasMinter) {
    await (await token.grantRole(MINTER_ROLE, dep.Vault)).wait();
    console.log("Token.grantRole(MINTER_ROLE, Vault) ✅");
  } else {
    console.log("Token: Vault already has MINTER_ROLE ✅");
  }

  // 4) Deploy Registry
  const Registry = await hre.ethers.getContractFactory("BorrowApprovalRegistry");
  const registry = await Registry.deploy(deployer.address, hre.ethers.ZeroAddress);
  await registry.waitForDeployment();
  dep.BorrowApprovalRegistry = registry.target;
  console.log("BorrowApprovalRegistry:", dep.BorrowApprovalRegistry);

  // 5) Deploy Receiver (forwarder set to deployer for now)
  const Receiver = await hre.ethers.getContractFactory("CREBorrowDecisionReceiver");
  const receiver = await Receiver.deploy(deployer.address, registry.target, deployer.address);
  await receiver.waitForDeployment();
  dep.CREBorrowDecisionReceiver = receiver.target;
  console.log("CREBorrowDecisionReceiver:", dep.CREBorrowDecisionReceiver);

  // 6) Grant registry WRITER_ROLE to receiver
  const WRITER_ROLE = await registry.WRITER_ROLE();
  await (await registry.grantRole(WRITER_ROLE, receiver.target)).wait();
  console.log("Registry.grantRole(WRITER_ROLE, receiver) ✅");

  // 7) Deploy BorrowGate with NEW args: (admin, pool, registry, verifier, root)
  const Gate = await hre.ethers.getContractFactory("BorrowGate");
  const gate = await Gate.deploy(
    deployer.address,
    pool.target,
    registry.target,
    verifier.target,
    TEMP_ROOT
  );
  await gate.waitForDeployment();
  dep.BorrowGate = gate.target;
  dep.currentRoot = TEMP_ROOT; // will be updated after Script A
  console.log("BorrowGate:", dep.BorrowGate);

  // 8) Wire BorrowGate into pool (prevents bypass)
  await (await pool.setBorrowGate(gate.target)).wait();
  console.log("Pool.setBorrowGate(gate) ✅");

  // Save JSON
  dep.chain = "sepolia";
  dep.chainId = 11155111;
  dep.updatedAt = new Date().toISOString();

  save(dep);

  console.log("\n✅ Updated deployments/sepolia.json:");
  console.log(dep);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
