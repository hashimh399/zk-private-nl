require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const DEPLOYMENTS_PATH = path.join(__dirname, "..", "deployments", "sepolia.json");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const dep = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));

  const receiver = await hre.ethers.getContractAt(
    "CREBorrowDecisionReceiver",
    dep.CREBorrowDecisionReceiver
  );

  // ===== EDIT THESE TWO VALUES BEFORE RUNNING =====
  const nullifier = process.env.NULLIFIER; // e.g. 0xabc...32 bytes
  const approved = process.env.APPROVED === "true"; // "true" or "false"
  // ===============================================

  if (!nullifier) throw new Error("Set NULLIFIER in env (32-byte hex).");

  const reasonCode = approved ? 0 : 1;
  const riskScore = 50; // uint16
  const ltvBps = 7000;  // uint16

  const report = hre.ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bool", "uint8", "uint16", "uint16"],
    [nullifier, approved, reasonCode, riskScore, ltvBps]
  );

  console.log("Writing decision via receiver.onReport()");
  console.log("nullifier:", nullifier);
  console.log("approved:", approved);

  const tx = await receiver.onReport(report);
  const receipt = await tx.wait();
  console.log("tx:", receipt.hash);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
