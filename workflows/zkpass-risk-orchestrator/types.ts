import type { Address } from "viem";

export type Config = {
  chainSelectorName: string;
  borrowGateAddress: Address;
  lendingPoolAddress: Address;
  registryAddress: Address;
  receiverAddress: Address;

  riskApiUrl: string;

  minFearGreed: number;
  minHfAfterE18: string;
  maxLtvBps: number;
  maxBorrowAmountWei: string;
  maxRiskScoreBp: number;

  enableGemini: boolean;
  geminiModel: string;

  gasLimit: string;
};

export type EVMLog = {
  topics: Uint8Array[];
  data: Uint8Array;
};

export const HF_ONE = 10n ** 18n;
export const PCT_BASE = 100n;