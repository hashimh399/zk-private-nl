import {
  Runner,
  consensusMedianAggregation,
  getNetwork,
  handler,
  cre,
  type Runtime,
} from "@chainlink/cre-sdk";

import { hexToBase64, ConsensusAggregationByFields, median} from "@chainlink/cre-sdk";
import {
  encodeAbiParameters,
  type Address,
} from "viem";

import type { Config, EVMLog } from "./types";
import { HF_ONE, PCT_BASE } from "./types";
import { clampUint16 } from "./utils";
import { fetchFearGreed, fetchGeminiRiskScoreWithDebug } from "./http";
import { buildGeminiPrompt } from "./prompts";
import { decideBorrow } from "./decision";
import {
  buildLogTrigger,
  decodeBorrowRequested,
  readBorrowGateRequest,
  isDecided,
  readPoolContext,
} from "./evm";
import { encodeDecisionPayload, writeDecisionReport } from "./report";

function initWorkflow(config: Config) {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const httpClient = new cre.capabilities.HTTPClient();

  const trigger = buildLogTrigger(evmClient, config.borrowGateAddress);

  const onLog = handler(trigger, (runtime: Runtime<Config>, log: EVMLog) => {
    const cfg = runtime.config;

    const { requestId, borrower, nullifier } = decodeBorrowRequested(log);

    console.log("🧾 [RiskOrchestrator] BorrowRequested received");
    console.log(`   requestId=${requestId.toString()}`);
    console.log(`   borrower=${borrower}`);
    console.log(`   nullifier=${nullifier}`);

    const req = readBorrowGateRequest(evmClient, runtime, cfg.borrowGateAddress, requestId);

    console.log("🔎 [RiskOrchestrator] BorrowGate.requests()");
    console.log(`   executed=${req.executed}`);
    console.log(`   reqBorrower=${req.borrower}`);
    console.log(`   reqAmountWei=${req.amount.toString()}`);
    console.log(`   reqNullifier=${req.nullifier}`);

    if (
      req.executed ||
      req.borrower.toLowerCase() !== borrower.toLowerCase() ||
      req.nullifier.toLowerCase() !== nullifier.toLowerCase()
    ) {
      console.log("⏭️ [RiskOrchestrator] Skipping: invalid/stale request");
      return "Request invalid/stale; skipping";
    }

    const alreadyDecided = isDecided(evmClient, runtime, cfg.registryAddress, nullifier);
    console.log(`🧷 [RiskOrchestrator] Registry.isDecided=${alreadyDecided}`);

    if (alreadyDecided) {
      console.log("⏭️ [RiskOrchestrator] Skipping: already decided");
      return "Already decided; skipping";
    }

    let collValue: bigint, debt: bigint, liqThr: bigint, hfNow: bigint;

    try {
      ({ collValue, debt, liqThr, hfNow } = readPoolContext(
        evmClient,
        runtime,
        cfg.lendingPoolAddress,
        borrower
      ));

      console.log("🏦 [RiskOrchestrator] Pool context");
      console.log(`   collateralValue=${collValue.toString()}`);
      console.log(`   debt=${debt.toString()}`);
      console.log(`   liquidationThreshold=${liqThr.toString()}`);
      console.log(`   hfNowE18=${hfNow.toString()}`);
    } catch (e: any) {
      console.log("❌ [RiskOrchestrator] Pool/oracle read failed; writing reject reason=6");
      console.log(`   error=${String(e?.message ?? e)}`);

      const payload = encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "bool" },
          { type: "uint8" },
          { type: "uint16" },
          { type: "uint16" },
        ],
        [nullifier, false, 6, 0, 65535]
      );

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

      return `REJECT reason=6 (pool/oracle read failed: ${String(e?.message ?? e)})`;
    }

    const debtAfter = debt + req.amount;
    const hfAfter =
      debtAfter === 0n
        ? (2n ** 256n - 1n)
        : (collValue * liqThr * HF_ONE) / (debtAfter * PCT_BASE);

    const ltvBpsBig = collValue === 0n ? 65535n : (debtAfter * 10000n) / collValue;
    const ltvBps = clampUint16(ltvBpsBig);

    console.log("🧮 [RiskOrchestrator] Derived metrics");
    console.log(`   debtAfter=${debtAfter.toString()}`);
    console.log(`   hfAfterE18=${hfAfter.toString()}`);
    console.log(`   ltvBps=${ltvBps}`);

    const fearGreed = httpClient
      .sendRequest(runtime, fetchFearGreed, consensusMedianAggregation<number>())(cfg.riskApiUrl)
      .result();

    console.log(`📉 [RiskOrchestrator] fearGreed=${fearGreed} (min=${cfg.minFearGreed})`);

   let riskScoreBp = 0;
let geminiStatus = -1;
let geminiSnippet = "";

console.log(`🧠 [RiskOrchestrator] Gemini enabled=${cfg.enableGemini}`);

if (cfg.enableGemini) {
  const secret = runtime.getSecret({ id: "GEMINI_API_KEY" }).result();
  const apiKey = secret?.value ?? "";

  console.log(`🧠 [RiskOrchestrator] Gemini apiKeyPresent=${apiKey.length > 0}`);
  console.log(`🧠 [RiskOrchestrator] Gemini model=${cfg.geminiModel}`);

  const prompt = buildGeminiPrompt({
    fearGreed,
    hfNowE18: hfNow,
    hfAfterE18: hfAfter,
    ltvBpsAfter: ltvBps,
    borrowAmountWei: req.amount,
  });

  console.log("🧠 [RiskOrchestrator] Gemini request -> sending");

  const g = httpClient
    .sendRequest(
      runtime,
      fetchGeminiRiskScoreWithDebug,
      ConsensusAggregationByFields<{ score: number; status: number }>({
        score: median,
        status: median,
      })
    )(apiKey, cfg.geminiModel, prompt)
    .result();

  riskScoreBp = g.score;
  geminiStatus = g.status;

  console.log("🧠 [RiskOrchestrator] Gemini response <- aggregated");
  console.log(`   status=${geminiStatus}`);
  console.log(`   riskScoreBp=${riskScoreBp}`);
} else {
  console.log("🧠 [RiskOrchestrator] Gemini skipped (enableGemini=false)");
}

    const decision = decideBorrow({
      fearGreed,
      minFearGreed: cfg.minFearGreed,
      hfAfter,
      minHfAfter: BigInt(cfg.minHfAfterE18),
      ltvBps,
      maxLtvBps: cfg.maxLtvBps,
      reqAmount: req.amount,
      maxBorrowAmount: BigInt(cfg.maxBorrowAmountWei),
    });

    console.log("✅ [RiskOrchestrator] Decision");
    console.log(`   approved=${decision.approved}`);
    console.log(`   reasonCode=${decision.reasonCode}`);

    const payload = encodeDecisionPayload({
      nullifier,
      approved: decision.approved,
      reasonCode: decision.reasonCode,
      riskScoreBp,
      ltvBps,
    });

    writeDecisionReport(evmClient, runtime, payload);

    return `Decision=${decision.approved ? "APPROVE" : "REJECT"} reason=${decision.reasonCode} fearGreed=${fearGreed} ltvBps=${ltvBps} riskScoreBp=${riskScoreBp} geminiStatus=${geminiStatus} geminiRiskScoreBp="${geminiSnippet}"`;
  });

  return [onLog];
}

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}