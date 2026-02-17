// workflows/zkpass-borrow-risk/main.ts
import {
  cre,
  type Runtime,
  Runner,
  getNetwork,
  bytesToHex,
  type EVMLog,
} from "@chainlink/cre-sdk";
import { keccak256, toHex, decodeEventLog, parseAbi } from "viem";

import {
  configSchema,
  type Config,
  ReasonCode,
  GeminiAdvisorySchema,
} from "./types";
import { readBorrowRequest, writeBorrowDecisionReport } from "./evm";
import { fetchFearGreedIndex } from "./risk";
import { askGeminiAdvisory } from "./gemini";

const eventAbi = parseAbi([
  "event BorrowRequested(uint256 indexed requestId,address indexed borrower,uint256 indexed nullifier,uint256 amount,address asset)",
]);
const eventSignature = "BorrowRequested(uint256,address,uint256,uint256,address)";

function computeGuardrails(runtime: Runtime<Config>, args: {
  fearGreed: number | null;
  hfAfter1e18: bigint;
  ltvAfterBps: number;
  amount: bigint;
}): { approved: boolean; reason: ReasonCode } {
  const p = runtime.config.decisionPolicy;
  const minHf = BigInt(p.minHfAfter1e18);
  const maxBorrow = BigInt(p.maxBorrowAmount);

  if (args.fearGreed === null) return { approved: false, reason: ReasonCode.OFFCHAIN_RISK_API_ERROR };
  if (args.fearGreed < p.fearGreedMin) return { approved: false, reason: ReasonCode.FEAR_GREED_TOO_LOW };
  if (args.hfAfter1e18 < minHf) return { approved: false, reason: ReasonCode.HF_TOO_LOW };
  if (args.ltvAfterBps > p.maxLtvAfterBps) return { approved: false, reason: ReasonCode.LTV_TOO_HIGH };
  if (args.amount > maxBorrow) return { approved: false, reason: ReasonCode.AMOUNT_TOO_HIGH };

  return { approved: true, reason: ReasonCode.OK_APPROVED };
}

const onLogTrigger = (runtime: Runtime<Config>, log: EVMLog): string => {
  // 1) Decode BorrowRequested
  const topics = log.topics.map((t) => bytesToHex(t)) as [`0x${string}`, ...`0x${string}`[]];
  const data = bytesToHex(log.data);

  const decodedLog = decodeEventLog({ abi: eventAbi, data, topics });
  const requestId = decodedLog.args.requestId as bigint;
  const borrower = decodedLog.args.borrower as `0x${string}`;
  const nullifier = decodedLog.args.nullifier as bigint;

  runtime.log(`BorrowRequested: requestId=${requestId.toString()} borrower=${borrower} nullifier=${nullifier.toString()}`);

  // 2) Onchain read: BorrowGate.getBorrowRequest(requestId)
  const req = readBorrowRequest(runtime, requestId);

  // Optional safety cross-check: event must match stored request
  if (req.borrower.toLowerCase() !== borrower.toLowerCase() || req.nullifier !== nullifier) {
    runtime.log(`Mismatch between event and onchain request. Rejecting.`);
    const txHash = writeBorrowDecisionReport(runtime, {
      requestId,
      nullifier,
      approved: false,
      reasonCode: ReasonCode.ONCHAIN_CONTEXT_MISMATCH,
      fearGreed: 0,
      ltvBps: req.ltvAfterBps,
      hfAfter1e18: req.hfAfter1e18,
      llmRiskScoreBp: 0,
      llmRec: 0,
      llmResponseHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    });
    runtime.log(`Decision write txHash=${txHash}`);
    return "Rejected: context mismatch";
  }

  // 3) Offchain risk API
  let fearGreed: number | null = null;
  try {
    fearGreed = fetchFearGreedIndex(runtime);
    runtime.log(`FearGreed=${fearGreed}`);
  } catch (e) {
    runtime.log(`FearGreed fetch failed: ${String(e)}`);
    fearGreed = null;
  }

  // 4) Deterministic guardrails
  const guardrail = computeGuardrails(runtime, {
    fearGreed,
    hfAfter1e18: req.hfAfter1e18,
    ltvAfterBps: req.ltvAfterBps,
    amount: req.amount,
  });

  // 5) Gemini advisory (optional / non-safety-critical)
  let llmRiskScoreBp = 0;
  let llmRec = 0; // 0=INCONCLUSIVE,1=APPROVE,2=REJECT
  let llmHash: `0x${string}` =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  try {
    const guardrailDecisionStr = guardrail.approved ? "APPROVE" : "REJECT";
    const advisoryInput = {
      requestId: requestId.toString(),
      borrower: req.borrower,
      amount: req.amount.toString(),
      hfAfter1e18: req.hfAfter1e18.toString(),
      ltvAfterBps: req.ltvAfterBps,
      fearGreed,
      guardrailDecision: guardrailDecisionStr,
      guardrailReasonCode: guardrail.reason,
    };

    // Keep input JSON stable: stringify an object literal with fixed key insertion order.
    const advisoryInputJson = JSON.stringify(advisoryInput);

    const g = askGeminiAdvisory(runtime, advisoryInputJson);
    runtime.log(`Gemini responseId=${g.responseId} advisory=${g.advisoryJson}`);

    // Validate strict JSON schema
    const parsed = GeminiAdvisorySchema.parse(JSON.parse(g.advisoryJson));
    llmRiskScoreBp = parsed.riskScoreBp;

    if (parsed.recommendation === "APPROVE") llmRec = 1;
    else if (parsed.recommendation === "REJECT") llmRec = 2;
    else llmRec = 0;

    // Hash full advisory JSON for audit anchoring
    llmHash = keccak256(toHex(g.advisoryJson));
  } catch (e) {
    runtime.log(`Gemini advisory failed/invalid: ${String(e)}`);
    // keep defaults; guardrails still decide
  }

  // 6) Final decision = guardrails (deterministic), plus advisory fields for transparency
  const txHash = writeBorrowDecisionReport(runtime, {
    requestId,
    nullifier,
    approved: guardrail.approved,
    reasonCode: guardrail.reason,
    fearGreed: fearGreed ?? 0,
    ltvBps: req.ltvAfterBps,
    hfAfter1e18: req.hfAfter1e18,
    llmRiskScoreBp,
    llmRec,
    llmResponseHash: llmHash,
  });

  runtime.log(`Decision recorded: approved=${guardrail.approved} reason=${guardrail.reason} txHash=${txHash}`);
  return guardrail.approved ? "Approved" : "Rejected";
};

const initWorkflow = (config: Config) => {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.evms[0].chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Network not found: ${config.evms[0].chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const topic0 = keccak256(toHex(eventSignature));

  return [
    cre.handler(
      evmClient.logTrigger({
        addresses: [config.evms[0].borrowGateAddress],
        topics: [{ values: [topic0] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onLogTrigger,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner({ configSchema });
  await runner.run(initWorkflow);
}

main();
