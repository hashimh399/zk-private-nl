/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const snarkjs = require("snarkjs");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hex32FromDec(decStr) {
  const bi = BigInt(decStr);
  return "0x" + bi.toString(16).padStart(64, "0");
}

function toSolidityProof(proof) {
  // snarkjs -> solidity calldata
  // pi_b must be swapped for Solidity verifier
  const a = [proof.pi_a[0], proof.pi_a[1]];
  const b = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]],
  ];
  const c = [proof.pi_c[0], proof.pi_c[1]];
  return { a, b, c };
}

(async () => {
  const passPath = process.argv[2];
  const amountNL = process.argv[3] || "10";

  if (!passPath) {
    console.error("Usage: node scripts/prove.js <pass.json> [amountNL]");
    process.exit(1);
  }

  const pass = readJson(passPath);

  const wasmPath = path.join(__dirname, "..", "build", "zkpass_js", "zkpass.wasm");
  const zkeyPath = path.join(__dirname, "..", "build", "zkpass_final.zkey");

  if (!fs.existsSync(wasmPath)) throw new Error("Missing wasm: " + wasmPath);
  if (!fs.existsSync(zkeyPath)) {
    throw new Error(
      "Missing zkey: " + zkeyPath + "\nGenerate build/zkpass_final.zkey locally (do not commit)."
    );
  }

  const input = {
    secret: BigInt(pass.secret).toString(),
    pathElements: pass.pathElements.map((x) => BigInt(x).toString()),
    pathIndices: pass.pathIndices,
    root: BigInt(pass.root).toString(),
    nullifier: BigInt(pass.nullifier).toString(),
    borrower: BigInt(pass.borrower).toString(),
    nonce: BigInt(pass.nonce).toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasmPath,
    zkeyPath
  );

  // Expect publicSignals order: [root, nullifier, borrower, nonce]
  const psRoot = hex32FromDec(publicSignals[0]);
  const psNull = hex32FromDec(publicSignals[1]);

  if (psRoot.toLowerCase() !== pass.root.toLowerCase()) {
    throw new Error("publicSignals[0] != root (ordering mismatch)");
  }
  if (psNull.toLowerCase() !== pass.nullifier.toLowerCase()) {
    throw new Error("publicSignals[1] != nullifier (ordering mismatch)");
  }

  console.log("✅ publicSignals order OK:", publicSignals);

  const sol = toSolidityProof(proof);

  // amount in wei (18 decimals)
  const amountWei = (BigInt(amountNL) * 10n ** 18n).toString();

  const out = {
    amount: amountWei,
    root: pass.root,
    nullifier: pass.nullifier,
    nonce: pass.nonce,
    a: sol.a,
    b: sol.b,
    c: sol.c,
  };

  const outPath = path.join(__dirname, "..", "proofCalldata.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log("✅ Wrote calldata:", outPath);
})();
