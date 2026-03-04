import { parseAbi } from "viem";

export const getAccountAbi = parseAbi([
  "function getAccountInfo(address) view returns (uint256 collateral, uint256 debt)",
]);

export const oracleAbi = parseAbi([
  "function getLatestPrice() view returns (uint256 price, uint256 updatedAt)",
]);

export const borrowGateAbi = parseAbi([
  "function nextRequestId() view returns (uint256)",
  "function requests(uint256) view returns (address borrower, uint256 amount, bytes32 nullifier, bool executed)",
]);

export const lendingPoolAbi = parseAbi([
  "function HealthFactor(address user) view returns (uint256)",
]);