// workflows/zkpass-borrow-risk/evm.ts
import {
  cre,
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  type Runtime,
} from "@chainlink/cre-sdk";
import { type Address, encodeFunctionData, decodeFunctionResult, parseAbi, encodeAbiParameters, parseAbiParameters, zeroAddress } from "viem";
import type { Config, BorrowRequestData } from "./types";

/**
 * ABI for onchain reads from BorrowGate.
 * Must match Solidity: getBorrowRequest(uint256) -> tuple(...)
 */
const borrowGateAbi = parseAbi([
  "function getBorrowRequest(uint256 requestId) view returns (address borrower,address asset,uint256 amount,uint256 nullifier,uint256 collateralValue,uint256 debtValue,uint256 hfAfter1e18,uint16 ltvAfterBps)",
]);

export function readBorrowRequest(runtime: Runtime<Config>, requestId: bigint): BorrowRequestData {
  const evmCfg = runtime.config.evms[0];

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmCfg.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmCfg.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const callData = encodeFunctionData({
    abi: borrowGateAbi,
    functionName: "getBorrowRequest",
    args: [requestId],
  });

  const contractCall = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: evmCfg.borrowGateAddress as Address,
        data: callData,
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();

  const decoded = decodeFunctionResult({
    abi: borrowGateAbi,
    functionName: "getBorrowRequest",
    data: bytesToHex(contractCall.data),
  }) as unknown as [
    Address,
    Address,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    number,
  ];

  return {
    borrower: decoded[0],
    asset: decoded[1],
    amount: decoded[2],
    nullifier: decoded[3],
    collateralValue: decoded[4],
    debtValue: decoded[5],
    hfAfter1e18: decoded[6],
    ltvAfterBps: decoded[7],
  };
}

/**
 * Report ABI to receiver:
 * (uint256 requestId, uint256 nullifier, uint8 approved, uint8 reasonCode, uint16 fearGreed, uint16 ltvBps, uint256 hfAfter1e18, uint16 llmRiskScoreBp, uint8 llmRec, bytes32 llmResponseHash)
 */
export function writeBorrowDecisionReport(
  runtime: Runtime<Config>,
  args: {
    requestId: bigint;
    nullifier: bigint;
    approved: boolean;
    reasonCode: number;
    fearGreed: number;
    ltvBps: number;
    hfAfter1e18: bigint;
    llmRiskScoreBp: number;
    llmRec: number; // 0=INCONCLUSIVE,1=APPROVE,2=REJECT
    llmResponseHash: `0x${string}`;
  },
): string {
  const evmCfg = runtime.config.evms[0];

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmCfg.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmCfg.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const reportData = encodeAbiParameters(
    parseAbiParameters(
      "uint256 requestId, uint256 nullifier, uint8 approved, uint8 reasonCode, uint16 fearGreed, uint16 ltvBps, uint256 hfAfter1e18, uint16 llmRiskScoreBp, uint8 llmRec, bytes32 llmResponseHash",
    ),
    [
      args.requestId,
      args.nullifier,
      args.approved ? 1 : 0,
      args.reasonCode,
      args.fearGreed,
      args.ltvBps,
      args.hfAfter1e18,
      args.llmRiskScoreBp,
      args.llmRec,
      args.llmResponseHash,
    ],
  );

  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmCfg.receiverAddress,
      report: reportResponse,
      gasConfig: { gasLimit: evmCfg.gasLimit },
    })
    .result();

  const txHash = bytesToHex(writeResult.txHash ?? new Uint8Array(32));
  return txHash;
}
