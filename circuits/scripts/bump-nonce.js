const fs = require("fs");
const path = require("path");
const circomlibjs = require("circomlibjs");

function toHex32(x) {
  let hex = x.toString(16).padStart(64, "0");
  return "0x" + hex;
}

function addrToField(addr) {
  return BigInt(addr);
}

(async () => {
  const passPath = process.argv[2];
  if (!passPath) {
    console.error("Usage: node scripts/bump-nonce.js <pass.json>");
    process.exit(1);
  }

  const pass = JSON.parse(fs.readFileSync(passPath, "utf8"));
  const poseidon = await circomlibjs.buildPoseidon();
  const F = poseidon.F;
  const H4 = (a, b, c, d) => F.toObject(poseidon([a, b, c, d]));

  const s = BigInt(pass.secret);
  const borrowerField = addrToField(pass.borrower);
  const nonce = BigInt(pass.nonce) + 1n;

  const nullifier = BigInt(H4(s, 1n, borrowerField, nonce));

  pass.nonce = nonce.toString();
  pass.nullifier = toHex32(nullifier);

  fs.writeFileSync(passPath, JSON.stringify(pass, null, 2));
  console.log("Updated nonce:", pass.nonce);
  console.log("Updated nullifier:", pass.nullifier);
})();
