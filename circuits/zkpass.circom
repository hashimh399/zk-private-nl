pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

template MerkleProofPoseidon(depth) {
    // Private inputs
    signal input secret;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // Public inputs (ORDER MATTERS)
    signal input root;
    signal input nullifier;
    signal input borrower;
    signal input nonce;

    // leaf = Poseidon(secret, borrower)
    component leafHash = Poseidon(2);
    leafHash.inputs[0] <== secret;
    leafHash.inputs[1] <== borrower;

    signal leaf;
    leaf <== leafHash.out;

    // Merkle components as arrays (Circom requires static declarations)
    component leftMux[depth];
    component rightMux[depth];
    component nodeHash[depth];

    signal cur[depth + 1];
    cur[0] <== leaf;

    var i;
    for (i = 0; i < depth; i++) {
        leftMux[i] = Mux1();
        rightMux[i] = Mux1();
        nodeHash[i] = Poseidon(2);

        // if index=0 => left=cur, right=sibling
        // if index=1 => left=sibling, right=cur
        leftMux[i].c[0] <== cur[i];
        leftMux[i].c[1] <== pathElements[i];
        leftMux[i].s <== pathIndices[i];

        rightMux[i].c[0] <== pathElements[i];
        rightMux[i].c[1] <== cur[i];
        rightMux[i].s <== pathIndices[i];

        nodeHash[i].inputs[0] <== leftMux[i].out;
        nodeHash[i].inputs[1] <== rightMux[i].out;

        cur[i + 1] <== nodeHash[i].out;
    }

    // Root must match
    root === cur[depth];

    // nullifier = Poseidon(secret, scope, borrower, nonce)
    component nHash = Poseidon(4);
    nHash.inputs[0] <== secret;
    nHash.inputs[1] <== 1; // scope constant for MVP
    nHash.inputs[2] <== borrower;
    nHash.inputs[3] <== nonce;

    nullifier === nHash.out;
}

component main { public [ root, nullifier, borrower, nonce ] } = MerkleProofPoseidon(20);

