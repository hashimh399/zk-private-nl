import { parseAbi } from "viem";

export const BorrowGateAbi = parseAbi([
  "function requests(uint256) view returns (address borrower,uint256 amount,bytes32 nullifier,bool executed)",
]);
