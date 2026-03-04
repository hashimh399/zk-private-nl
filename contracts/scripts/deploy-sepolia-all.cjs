/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // === CONFIG YOU MUST SET ===
  const ADMIN = deployer.address;

  // Sepolia CRE simulation forwarder (MockForwarder) — set this to the one CRE docs instruct for simulation
  // If you're unsure, keep it as env var so you can change without redeploying receiver.
  const FORWARDER = process.env.CRE_FORWARDER;
  if (!FORWARDER) throw new Error("Set CRE_FORWARDER in env (Sepolia MockForwarder address)");

  // Merkle root from circuits (bytes32 hex)
  const INITIAL_ROOT = process.env.INITIAL_ROOT;
  if (!INITIAL_ROOT) throw new Error("Set INITIAL_ROOT in env (0x... 32 bytes)");

  // Protocol params
  const NL_NAME = "NeuroLedger";
  const NL_SYMBOL = "NL";
  const NL_CAP = ethers.parseUnits("10000000", 18); // 10m cap
  const DAILY_MINT_LIMIT = ethers.parseUnits("1000000", 18); // 1m/day for demo

  // Oracle price (8 decimals). Example: $3000 * 1e8
  const INITIAL_PRICE_8 = 3000n * 10n ** 8n;

  // === 1) Deploy NL token ===
  const NL = await ethers.getContractFactory("NeuroLedger");
  const nl = await NL.deploy(NL_NAME, NL_SYMBOL, NL_CAP, ADMIN);
  await nl.waitForDeployment();
  console.log("NL:", nl.target);

  // === 2) Deploy Vault ===
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(ADMIN, nl.target, DAILY_MINT_LIMIT);
  await vault.waitForDeployment();
  console.log("Vault:", vault.target);

  // === 3) Deploy Oracle ===
  const Oracle = await ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(INITIAL_PRICE_8);
  await oracle.waitForDeployment();
  console.log("Oracle:", oracle.target);

  // === 4) Deploy LendingPool ===
  const Pool = await ethers.getContractFactory("LendingPool");
  const pool = await Pool.deploy(ADMIN, vault.target, oracle.target, nl.target);
  await pool.waitForDeployment();
  console.log("LendingPool:", pool.target);

  // === 5) Wire Vault POOL_ROLE ===
  const tx1 = await vault.setPool(pool.target);
  await tx1.wait();
  console.log("Vault.setPool -> ok");

  // === 6) Give LendingPool mint/burn ability on NL (MINTER_ROLE) ===
  // Your Vault.mintNL calls token.mint() and token.mint requires MINTER_ROLE.
  // Currently MINTER_ROLE is granted only to defaultAdmin in NL constructor.
  // Easiest: grant MINTER_ROLE to vault (since vault is the minter).
  const MINTER_ROLE = await nl.MINTER_ROLE();
  const tx2 = await nl.grantRole(MINTER_ROLE, vault.target);
  await tx2.wait();
  console.log("NL.grantRole(MINTER_ROLE, Vault) -> ok");

  // === 7) Deploy Groth16Verifier ===
  const Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  console.log("Groth16Verifier:", verifier.target);

  // === 8) Deploy Registry with admin as temporary writer ===
  const Registry = await ethers.getContractFactory("BorrowApprovalRegistry");
  const registry = await Registry.deploy(ADMIN, ADMIN);
  await registry.waitForDeployment();
  console.log("Registry:", registry.target);

  // === 9) Deploy Receiver ===
  const Receiver = await ethers.getContractFactory("CREBorrowDecisionReceiver");
  const receiver = await Receiver.deploy(ADMIN, registry.target, FORWARDER);
  await receiver.waitForDeployment();
  console.log("Receiver:", receiver.target);

  // === 10) Grant WRITER_ROLE to Receiver, optionally revoke from admin ===
  const WRITER_ROLE = await registry.WRITER_ROLE();
  await (await registry.grantRole(WRITER_ROLE, receiver.target)).wait();
  console.log("Registry.grantRole(WRITER_ROLE, Receiver) -> ok");

  // Optional hygiene:
  // await (await registry.revokeRole(WRITER_ROLE, ADMIN)).wait();

  // === 11) Deploy BorrowGate ===
  const Gate = await ethers.getContractFactory("BorrowGate");
  const gate = await Gate.deploy(ADMIN, pool.target, registry.target, verifier.target, INITIAL_ROOT);
  await gate.waitForDeployment();
  console.log("BorrowGate:", gate.target);

  // === 12) Wire BorrowGate into LendingPool ===
  await (await pool.setBorrowGate(gate.target)).wait();
  console.log("LendingPool.setBorrowGate -> ok");

  // === Save deployments ===
  const out = {
    network: "sepolia",
    deployer: deployer.address,
    NL: nl.target,
    Vault: vault.target,
    MockOracle: oracle.target,
    LendingPool: pool.target,
    Groth16Verifier: verifier.target,
    BorrowApprovalRegistry: registry.target,
    CREBorrowDecisionReceiver: receiver.target,
    BorrowGate: gate.target,
    forwarder: FORWARDER,
    root: INITIAL_ROOT,
    timestamp: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployments", "sepolia.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
