/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const fixed = require("fixed-merkle-tree");
const MerkleTree = fixed.MerkleTree || fixed;
const circomlibjs = require("circomlibjs");

const DEPTH = 20;

// BN254 scalar field
const SNARK_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function toHex32(x) {
  let hex = x.toString(16);
  hex = hex.padStart(64, "0");
  return "0x" + hex;
}

function addrToField(addr) {
  return BigInt(addr);
}

function readJsonSafe(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeLeaves(rawLeaves) {
  if (!Array.isArray(rawLeaves)) return [];
  const out = [];
  for (const v of rawLeaves) {
    try {
      out.push(BigInt(v)); // supports "0x.." strings
    } catch {
      // ignore invalid
    }
  }
  return out;
}

(async () => {
  const borrower = process.argv[2];
  if (!borrower || !borrower.startsWith("0x") || borrower.length !== 42) {
    console.error("Usage: node scripts/issue-pass.js <borrowerAddress0x...>");
    process.exit(1);
  }

  const poseidon = await circomlibjs.buildPoseidon();
  const F = poseidon.F;

  // Poseidon helpers returning bigint
  const H2 = (a, b) => F.toObject(poseidon([a, b]));
  const H4 = (a, b, c, d) => F.toObject(poseidon([a, b, c, d]));

  const leavesPath = path.join(__dirname, "..", "allowlist.leaves.json");
  const rawLeaves = readJsonSafe(leavesPath, []);
  const leafBigints = normalizeLeaves(rawLeaves);

  // Generate secret s (field element)
  const s =
    BigInt("0x" + crypto.randomBytes(31).toString("hex")) % SNARK_FIELD;

  const borrowerField = addrToField(borrower);

  // leaf = Poseidon(s, borrower)
  const leaf = BigInt(H2(s, borrowerField));

  // Append leaf
  leafBigints.push(leaf);
  const leafIndex = leafBigints.length - 1; // deterministic insertion index

  // Persist leaves as 0x hex
  fs.writeFileSync(
    leavesPath,
    JSON.stringify(leafBigints.map(toHex32), null, 2)
  );

  // Build Merkle tree
  const tree = new MerkleTree(DEPTH, leafBigints, {
    hashFunction: (l, r) => H2(BigInt(l), BigInt(r)),
    zeroElement: 0n,
  });

  const root = BigInt(tree.root);

  /**
   * CRITICAL FIX:
   * In your fixed-merkle-tree version, tree.proof(x) expects a LEAF VALUE.
   * We want an index-based path → use tree.path(index).
   */
  const { pathElements, pathIndices } = tree.path(leafIndex);

  const pathElementsHex = pathElements.map((x) => toHex32(BigInt(x)));
  const pathIndicesNum = pathIndices.map((x) => Number(x));

  // nonce starts at 0 for demo
  const nonce = 0n;

  // nullifier = Poseidon(s, scope=1, borrower, nonce)
  const nullifier = BigInt(H4(s, 1n, borrowerField, nonce));

  const pass = {
    borrower,
    secret: toHex32(s),
    leaf: toHex32(leaf),
    root: toHex32(root),
    nullifier: toHex32(nullifier),
    nonce: nonce.toString(),
    depth: DEPTH,
    leafIndex,
    pathElements: pathElementsHex,
    pathIndices: pathIndicesNum,
  };

  const passPath = path.join(__dirname, "..", `pass.${borrower}.json`);
  fs.writeFileSync(passPath, JSON.stringify(pass, null, 2));

  console.log("✅ Issued pass and built tree");
  console.log("Leaves file:", leavesPath);
  console.log("Pass file:", passPath);
  console.log("LeafIndex:", leafIndex);
  console.log("Root:", pass.root);
  console.log("Nullifier:", pass.nullifier);
})();
