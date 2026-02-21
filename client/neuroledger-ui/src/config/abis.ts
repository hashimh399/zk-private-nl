export const lendingPoolAbi = [
  { type: "function", name: "deposit", inputs: [], outputs: [], stateMutability: "payable" },
  { type: "function", name: "withDrawCollateral", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "repay", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "ethCollateral", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "tokenDebt", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "HealthFactor", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export const nlTokenAbi = [
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

export const borrowGateAbi = [
  {
    type: "function",
    name: "requestBorrow",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "root", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "a", type: "uint256[2]" },
      { name: "b", type: "uint256[2][2]" },
      { name: "c", type: "uint256[2]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeBorrow",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "requests",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "borrower", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "nullifier", type: "bytes32" },
      { name: "executed", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "BorrowRequested",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "borrower", type: "address", indexed: true },
      { name: "nullifier", type: "bytes32", indexed: true }, // ✅ FIX
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BorrowExecuted",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "nullifier", type: "bytes32", indexed: true },
    ],
  },
] as const;

export const borrowApprovalRegistryAbi = [
  {
    type: "function",
    name: "isDecided",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isApproved",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decisions",
    inputs: [{ name: "nullifier", type: "bytes32" }],
    outputs: [
      { name: "decided", type: "bool" },
      { name: "approved", type: "bool" },
      { name: "rejected", type: "bool" },      // ✅ FIX: was executed
      { name: "reasonCode", type: "uint8" },   // ✅ FIX
      { name: "decidedAt", type: "uint40" },   // ✅ FIX
      { name: "riskScore", type: "uint16" },   // ✅ FIX
      { name: "ltvBps", type: "uint16" },      // ✅ FIX
    ],
    stateMutability: "view",
  },
] as const;
