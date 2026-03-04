// contracts/interfaces/IZKPassVerifier.sol
pragma solidity ^0.8.20;

interface IZKPassVerifier {
  function verifyProof(
    uint256[2] calldata a,
    uint256[2][2] calldata b,
    uint256[2] calldata c,
    uint256[4] calldata publicSignals // [root, nullifier, borrowerAddrField, nonce]
  ) external view returns (bool);
}
