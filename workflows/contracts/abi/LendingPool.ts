import { parseAbi } from "viem";

export const LendingPoolAbi = parseAbi([
  "function collateralValueOf(address) view returns (uint256)",
  "function tokenDebt(address) view returns (uint256)",
  "function liquidationThreshold() view returns (uint256)",
  "function HealthFactor(address) view returns (uint256)"
]);
