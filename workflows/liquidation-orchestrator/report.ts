import { encodeAbiParameters, type Address } from "viem";
import { cre, hexToBase64, type Runtime } from "@chainlink/cre-sdk";
import type { Config } from "./types";

export function encodeLiquidationPayload(
  target: Address,
  repay: bigint
): `0x${string}` {
  return encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }],
    [target, repay]
  );
}

export async function writeLiquidationReport(
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  runtime: Runtime<Config>,
  payloadHex: `0x${string}`
) {
  const cfg = runtime.config;

  const report = await runtime
    .report({
      encodedPayload: hexToBase64(payloadHex),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  await evmClient
    .writeReport(runtime, {
      receiver: cfg.receiverAddress,
      report,
      gasConfig: { gasLimit: cfg.gasLimit },
    })
    .result();
}