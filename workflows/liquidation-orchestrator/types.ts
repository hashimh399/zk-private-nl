import type { Address } from "viem";

export type Config = {
  chainSelectorName: string;
  borrowGateAddress: Address;
  lendingPoolAddress: Address;
  receiverAddress: Address;
  oracle: Address;
  gasLimit: string;
};

export const HF_ONE = 10n ** 18n;