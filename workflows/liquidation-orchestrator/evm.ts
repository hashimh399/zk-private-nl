import { bytesToHex, encodeCallMsg, cre, type Runtime } from "@chainlink/cre-sdk";
import {
  decodeAbiParameters,
  encodeFunctionData,
  zeroAddress,
  type Address,
} from "viem";

import { borrowGateAbi, lendingPoolAbi, getAccountAbi, oracleAbi } from "./abi";
import type { Config } from "./types";

function unwrapReturnBytes(res: any): Uint8Array | null {
  const raw = res?.data ?? res?.returnData;
  if (!raw) return null;
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw as any);
}

export async function readNextRequestId(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  borrowGate: Address
): Promise<bigint> {
  const callData = encodeFunctionData({ abi: borrowGateAbi, functionName: "nextRequestId" });

  const res = await evmClient.callContract(runtime, {
    call: encodeCallMsg({ from: zeroAddress, to: borrowGate, data: callData }),
  }).result();

  const b = unwrapReturnBytes(res);
  if (!b) throw new Error("Failed to read nextRequestId");

  const [nextId] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(new Uint8Array(b))) as [bigint];
  return nextId;
}

export async function readBorrowGateRequest(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  borrowGate: Address,
  id: bigint
): Promise<{ borrower: Address; executed: boolean }> {
  const callData = encodeFunctionData({
    abi: borrowGateAbi,
    functionName: "requests",
    args: [id],
  });

  const res = await evmClient.callContract(runtime, {
    call: encodeCallMsg({ from: zeroAddress, to: borrowGate, data: callData }),
  }).result();

  const b = unwrapReturnBytes(res);
  if (!b) throw new Error(`BorrowGate.requests(${id}) returned no data`);

  const [borrower, , , executed] = decodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bool" }],
    bytesToHex(new Uint8Array(b))
  ) as [Address, bigint, `0x${string}`, boolean];

  return { borrower, executed };
}

export async function readHealthFactor(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  lendingPool: Address,
  user: Address
): Promise<bigint> {
  const callData = encodeFunctionData({
    abi: lendingPoolAbi,
    functionName: "HealthFactor",
    args: [user],
  });

  const res = await evmClient.callContract(runtime, {
    call: encodeCallMsg({ from: zeroAddress, to: lendingPool, data: callData }),
  }).result();

  const b = unwrapReturnBytes(res);
  if (!b) throw new Error("HealthFactor returned no data");

  const [hf] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(new Uint8Array(b))) as [bigint];
  return hf;
}

export async function readAccountInfo(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  lendingPool: Address,
  user: Address
): Promise<{ collateral: bigint; debt: bigint }> {
  const callData = encodeFunctionData({
    abi: getAccountAbi,
    functionName: "getAccountInfo",
    args: [user],
  });

  const res = await evmClient.callContract(runtime, {
    call: encodeCallMsg({ from: zeroAddress, to: lendingPool, data: callData }),
  }).result();

  const b = unwrapReturnBytes(res);
  if (!b) throw new Error("getAccountInfo returned no data");

  const [collateral, debt] = decodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }],
    bytesToHex(new Uint8Array(b))
  ) as [bigint, bigint];

  return { collateral, debt };
}

export async function readOraclePrice18(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  oracle: Address
): Promise<bigint> {
  const callData = encodeFunctionData({ abi: oracleAbi, functionName: "getLatestPrice" });

  const res = await evmClient.callContract(runtime, {
    call: encodeCallMsg({ from: zeroAddress, to: oracle, data: callData }),
  }).result();

  const b = unwrapReturnBytes(res);
  if (!b) throw new Error("oracle.getLatestPrice returned no data");

  const [price8] = decodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }],
    bytesToHex(new Uint8Array(b))
  ) as [bigint, bigint];

  return price8 * 10n ** 10n;
}