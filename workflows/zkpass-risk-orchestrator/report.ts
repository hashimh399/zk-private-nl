import { encodeAbiParameters, type Address } from "viem";
import type { Runtime } from "@chainlink/cre-sdk";
import { cre, hexToBase64 } from "@chainlink/cre-sdk";
import { clampUint16 } from "./utils";
import type { Config } from "./types";

export function encodeDecisionPayload(params: {
  nullifier: `0x${string}`;
  approved: boolean;
  reasonCode: number;
  riskScoreBp: number; // [0..10000]
  ltvBps: number;      // uint16
}): `0x${string}` {
  return encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "bool" },
      { type: "uint8" },
      { type: "uint16" },
      { type: "uint16" },
    ],
    [
      params.nullifier,
      params.approved,
      params.reasonCode,
      clampUint16(BigInt(params.riskScoreBp)),
      clampUint16(BigInt(params.ltvBps)),
    ]
  );
}

export async function writeDecisionReport(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  payload: `0x${string}`
) {
  const cfg = runtime.config;

  const report = runtime
    .report({
      encodedPayload: hexToBase64(payload),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  evmClient
    .writeReport(runtime, {
      receiver: cfg.receiverAddress,
      report,
      gasConfig: { gasLimit: cfg.gasLimit },
    })
    .result();
}