export const SEPOLIA_CHAIN_ID = 11155111;

export const CONTRACTS = {
  deployer: (import.meta.env.VITE_DEPLOYER ?? "0xeE7B99c587C1667b396EbC87a176136Be1B4f031") as `0x${string}`,
  nlToken: (import.meta.env.VITE_NL_TOKEN ?? "0x1C279bBfAE9Ee1B72D913EF8c67310Ea80E99cdA") as `0x${string}`,
  vault: (import.meta.env.VITE_VAULT ?? "0x238DFDc3D131Fd758a02053E3654952720409D99") as `0x${string}`,
  mockOracle: (import.meta.env.VITE_MOCK_ORACLE ?? "0x09432E9196B9ec5076a965C527A817e6cC675FCD") as `0x${string}`,
  lendingPool: (import.meta.env.VITE_LENDING_POOL ?? "0xc3E5446ca742122A549Bb643fa88a6C36faD066f") as `0x${string}`,
  groth16Verifier: (import.meta.env.VITE_GROTH16_VERIFIER ?? "0x4d4E3cd51189Fb89985bA7D19AAeE5C39252B132") as `0x${string}`,
  borrowApprovalRegistry: (import.meta.env.VITE_BORROW_APPROVAL_REGISTRY ?? "0x5996b480a0207619026A9BC55aaf9fBAD8D0d3ff") as `0x${string}`,
  creBorrowDecisionReceiver: (import.meta.env.VITE_CRE_RECEIVER ?? "0xc97d7E41414faCBA40020EAC065B32A6a3FF612c") as `0x${string}`,
  borrowGate: (import.meta.env.VITE_BORROW_GATE ?? "0x01d91f11f948AB420Ed2876402a60BdF3d1e73A7") as `0x${string}`,
  forwarder: (import.meta.env.VITE_FORWARDER ?? "0x15fC6ae953E024d975e77382eEeC56A9101f9F88") as `0x${string}`,
  currentMerkleRoot: "0x02f27cd79ce8de2118d00d2a29e267c847852fe74cc73b8c15bd4687255eed60" as `0x${string}`,
} as const;

export const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

export const etherscanTx = (hash: string) => `${ETHERSCAN_BASE}/tx/${hash}`;
export const etherscanAddress = (addr: string) => `${ETHERSCAN_BASE}/address/${addr}`;

export const CONTRACT_LABELS: Record<string, string> = {
  deployer: "Deployer/Admin EOA",
  nlToken: "NL Token (ERC20)",
  vault: "Vault",
  mockOracle: "MockOracle",
  lendingPool: "LendingPool",
  groth16Verifier: "Groth16Verifier",
  borrowApprovalRegistry: "BorrowApprovalRegistry",
  creBorrowDecisionReceiver: "CREBorrowDecisionReceiver",
  borrowGate: "BorrowGate",
  forwarder: "Forwarder",
};
