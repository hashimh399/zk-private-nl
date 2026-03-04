import { Runner, cre, type Runtime } from "@chainlink/cre-sdk";
import type { Address } from "viem";
import type { Config } from "./types";
import { HF_ONE } from "./types";
import { discoverBorrowersByScanningRequests } from "./discover";
import { readHealthFactor, readAccountInfo, readOraclePrice18 } from "./evm";
import { computeOptimalRepay } from "./math";
import { encodeLiquidationPayload, writeLiquidationReport } from "./report";

function initWorkflow(config: Config) {
  // keep your sepolia selector hardcoded for now if you want, but config.chainSelectorName exists
  const evmClient = new cre.capabilities.EVMClient(16015286601757825753n);

  const cron = new cre.capabilities.CronCapability();
  const trigger = cron.trigger({ schedule: "0 * * * * *" });

  const onTick = cre.handler(trigger, async (runtime: Runtime<Config>) => {
    const cfg = runtime.config;
    console.log("🔍 [CRE Engine] Initiating Protocol Solvency Sweep...");

   // const borrowers = await discoverBorrowersByScanningRequests(evmClient, runtime, cfg.borrowGateAddress);
   const borrowers = new Set<Address>([
      "0x15d265dc32a575755aca19b5eceab8018cdd26f1",
      "0x17ffbcc299688241ed00e0a88ab379ed99d3445b",
      "0xee7b99c587c1667b396ebc87a176136be1b4f031",
      "0x6BF1459a3EE0E645B7b0F74d23956FEdf2f4fc5F"
    ]);
    console.log(`📊 [CRE Engine] Tracking ${borrowers.size} active borrowers.`);

    let target: Address | null = null;

    for (const b of borrowers) {
      const hf = await readHealthFactor(evmClient, runtime, cfg.lendingPoolAddress, b);
      console.log(`   ├─ Borrower: ${b.slice(0, 8)}... HF: ${(Number(hf) / 1e18).toFixed(4)}`);

      if (hf < HF_ONE) {
        target = b;
        break;
      }
    }

    if (!target) return `All ${borrowers.size} borrowers are solvent.`;

    console.log(`🚨 [CRE ENGINE] DANGER DETECTED: ${target}`);

    const { collateral, debt } = await readAccountInfo(evmClient, runtime, cfg.lendingPoolAddress, target);
    const price18 = await readOraclePrice18(evmClient, runtime, cfg.oracle);

    const repay = computeOptimalRepay({ collateralWei: collateral, debtWei: debt, price18 });

    console.log(`   ├─ Computed Optimal Repay: ${Number(repay) / 1e18} NL`);

    const payload = encodeLiquidationPayload(target, repay);
    await writeLiquidationReport(evmClient, runtime, payload);

    return `LIQUIDATED: ${target} for ${repay}`;
  });

  return [onTick];
}

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}