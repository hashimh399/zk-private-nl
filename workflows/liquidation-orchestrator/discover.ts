import type { Address } from "viem";
import type { Runtime } from "@chainlink/cre-sdk";
import type { Config } from "./types";
import { readNextRequestId, readBorrowGateRequest } from "./evm";
import { cre } from "@chainlink/cre-sdk";

export async function discoverBorrowersByScanningRequests(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  borrowGate: Address
): Promise<Set<Address>> {
  const nextId = await readNextRequestId(evmClient, runtime, borrowGate);

  const borrowers = new Set<Address>();
  for (let i = 0n; i < nextId; i++) {
    try {
      const { borrower, executed } = await readBorrowGateRequest(evmClient, runtime, borrowGate, i);
      if (executed) borrowers.add(borrower);
    } catch {
      // ignore a single bad read
    }
  }
  return borrowers;
}