import { parseAbi } from "viem";

export const BorrowApprovalRegistryAbi = parseAbi([
  "function isDecided(bytes32) view returns (bool)",
]);
