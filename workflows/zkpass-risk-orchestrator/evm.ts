import {
  bytesToHex,
  encodeCallMsg,
  cre,
  type Runtime,
} from "@chainlink/cre-sdk";

import { hexToBase64 } from "@chainlink/cre-sdk";
import {
  decodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toBytes,
  zeroAddress,
  type Address,
} from "viem";

import { BorrowGateAbi, BorrowApprovalRegistryAbi, LendingPoolAbi } from "../contracts/abi/index.js";
import type { Config, EVMLog } from "./types";

export function getBorrowRequestedTopic0(): `0x${string}` {
  const sig = "BorrowRequested(uint256,address,bytes32,uint256)";
  return keccak256(toBytes(sig));
}

/** CRE SDK callContract return shape differs across versions. */
export function getReturnBytes(res: any, label: string): Uint8Array {
  const raw = res?.data ?? res?.returnData ?? res?.result?.data ?? res?.result?.returnData;
  if (!raw) throw new Error(`${label}: callContract returned no data/returnData`);

  if (raw instanceof Uint8Array) return raw;
  if (ArrayBuffer.isView(raw) && raw.buffer) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (Array.isArray(raw)) return new Uint8Array(raw);

  throw new Error(`${label}: unsupported return bytes type`);
}

export function decodeBorrowRequested(log: EVMLog): {
  requestId: bigint;
  borrower: Address;
  nullifier: `0x${string}`;
} {
  const requestId = BigInt(bytesToHex(log.topics[1]));
  const borrowerTopicHex = bytesToHex(log.topics[2]); // 0x + 64 chars
  const borrower = ("0x" + borrowerTopicHex.slice(-40)) as Address;
  const nullifier = bytesToHex(log.topics[3]) as `0x${string}`;
  return { requestId, borrower, nullifier };
}

export function buildLogTrigger(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  borrowGate: Address
) {
  const topic0 = getBorrowRequestedTopic0();
  return evmClient.logTrigger({
    addresses: [hexToBase64(borrowGate)],
    topics: [{ values: [hexToBase64(topic0)] }],
  });
}

export function readBorrowGateRequest(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  borrowGate: Address,
  requestId: bigint
): { borrower: Address; amount: bigint; nullifier: `0x${string}`; executed: boolean } {
  const call = encodeFunctionData({
    abi: BorrowGateAbi,
    functionName: "requests",
    args: [requestId],
  });

  const res = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: borrowGate, data: call }),
    })
    .result();

  const bytes = getReturnBytes(res, "BorrowGate.requests");

  const [b, amt, n, executed] = decodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bool" }],
    bytesToHex(bytes)
  ) as [Address, bigint, `0x${string}`, boolean];

  return { borrower: b, amount: amt, nullifier: n, executed };
}

export function isDecided(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  registry: Address,
  nullifier: `0x${string}`
): boolean {
  const call = encodeFunctionData({
    abi: BorrowApprovalRegistryAbi,
    functionName: "isDecided",
    args: [nullifier],
  });

  const res = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: registry, data: call }),
    })
    .result();

  const [v] = decodeAbiParameters([{ type: "bool" }], bytesToHex(getReturnBytes(res, "Registry.isDecided"))) as [boolean];
  return v;
}

export function readPoolContext(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  lendingPool: Address,
  borrower: Address
): { collValue: bigint; debt: bigint; liqThr: bigint; hfNow: bigint } {
  const collValueCall = encodeFunctionData({ abi: LendingPoolAbi, functionName: "collateralValueOf", args: [borrower] });
  const debtCall = encodeFunctionData({ abi: LendingPoolAbi, functionName: "tokenDebt", args: [borrower] });
  const liqThrCall = encodeFunctionData({ abi: LendingPoolAbi, functionName: "liquidationThreshold", args: [] });
  const hfNowCall = encodeFunctionData({ abi: LendingPoolAbi, functionName: "HealthFactor", args: [borrower] });

  const collRes = evmClient.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: lendingPool, data: collValueCall }) }).result();
  const [collValue] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(collRes, "Pool.collateralValueOf"))) as [bigint];

  const debtRes = evmClient.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: lendingPool, data: debtCall }) }).result();
  const [debt] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(debtRes, "Pool.tokenDebt"))) as [bigint];

  const liqRes = evmClient.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: lendingPool, data: liqThrCall }) }).result();
  const [liqThr] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(liqRes, "Pool.liquidationThreshold"))) as [bigint];

  const hfRes = evmClient.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: lendingPool, data: hfNowCall }) }).result();
  const [hfNow] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(hfRes, "Pool.HealthFactor"))) as [bigint];

  return { collValue, debt, liqThr, hfNow };
}