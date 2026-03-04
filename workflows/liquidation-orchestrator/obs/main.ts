import {
  Runner,
  bytesToHex,
  encodeCallMsg,
  cre,
  type Runtime,
} from "@chainlink/cre-sdk"

import {
  encodeAbiParameters,
  encodeFunctionData,
  decodeAbiParameters,
  zeroAddress,
  parseAbi,
  type Address,
} from "viem"

type Config = {
  chainSelectorName: string;
  borrowGateAddress: Address;
  lendingPoolAddress: Address;
  receiverAddress: Address;
  oracle: Address;
  gasLimit: string;
}

const HF_ONE = 10n ** 18n;

// Inline ABIs for clean compilation
const getAccountAbi = parseAbi(["function getAccountInfo(address) view returns (uint256 collateral, uint256 debt)"]);
const oracleAbi = parseAbi(["function getLatestPrice() view returns (uint256 price, uint256 updatedAt)"]);
const borrowGateAbi = parseAbi([
  "function nextRequestId() view returns (uint256)",
  "function requests(uint256) view returns (address borrower, uint256 amount, bytes32 nullifier, bool executed)"
]);

const lendingPoolAbi = parseAbi([
  "function HealthFactor(address user) view returns (uint256)"
]);

function initWorkflow(config: Config) {
  // CCIP Selector for Ethereum Sepolia
  const evmClient = new cre.capabilities.EVMClient(16015286601757825753n);

  // 🚨 CRITICAL FIX: Using the correct CRE Cron Capability
  const cron = new cre.capabilities.CronCapability();
  const trigger = cron.trigger({ schedule: "0 * * * * *" }); // 6-part cron for exact seconds

  const onTick = cre.handler(trigger, async (runtime: Runtime<Config>) => {
    const cfg = runtime.config;

    console.log("🔍 [CRE Engine] Initiating Protocol Solvency Sweep...");

    // 1. Get total number of requests from BorrowGate
    const nextIdCall = encodeFunctionData({
      abi: borrowGateAbi,
      functionName: "nextRequestId",
    });

    const nextIdRes = await evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: cfg.borrowGateAddress, data: nextIdCall }),
    }).result();

    const rawNextId = nextIdRes?.data ?? nextIdRes?.returnData;
    if (!rawNextId) return "Failed to read nextRequestId";
    
    const [nextId] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(new Uint8Array(rawNextId as any))) as [bigint];

    // 2. Discover active borrowers by scanning historical requests
    const uniqueBorrowers = new Set<string>();
    
    for (let i = 0n; i < nextId; i++) {
      const reqCall = encodeFunctionData({
        abi: borrowGateAbi,
        functionName: "requests",
        args: [i],
      });

      const reqRes = await evmClient.callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: cfg.borrowGateAddress, data: reqCall }),
      }).result();

      const rawReq = reqRes?.data ?? reqRes?.returnData;
      if (!rawReq) continue;

      const [reqBorrower, , , executed] = decodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }, { type: "bool" }],
        bytesToHex(new Uint8Array(rawReq as any))
      ) as [Address, bigint, `0x${string}`, boolean];

      if (executed) {
        uniqueBorrowers.add(reqBorrower);
      }
    }

    console.log(`📊 [CRE Engine] Tracking ${uniqueBorrowers.size} active borrowers.`);

    let targetToLiquidate: string | null = null;

    // 3. Evaluate risk offchain
    for (const borrower of uniqueBorrowers) {
      const hfCall = encodeFunctionData({
        abi: lendingPoolAbi,
        functionName: "HealthFactor",
        args: [borrower as Address],
      });

      const hfRes = await evmClient.callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: hfCall }),
      }).result();

      const rawHf = hfRes?.data ?? hfRes?.returnData;
      if (!rawHf) continue;

      const [hf] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(new Uint8Array(rawHf as any))) as [bigint];

      const hfDecimal = Number(hf) / 1e18;
      console.log(`   ├─ Borrower: ${borrower.slice(0, 8)}... HF: ${hfDecimal.toFixed(4)}`);

      if (hf < HF_ONE) {
        targetToLiquidate = borrower;
        break; // Liquidate one target per workflow cycle
      }
    }

    // 4. Output consensus decision
    // if (targetToLiquidate) {
    //   console.log(`🚨 [CRE ENGINE] DANGER DETECTED. Issuing liquidation report for: ${targetToLiquidate}`);

    //   const payload = encodeAbiParameters(
    //     [{ type: "address" }],
    //     [targetToLiquidate as Address]
    //   );

    //   // CRE SDK requires payload to be base64 encoded
    //   const report = await runtime.report({
    //     encodedPayload: Buffer.from(payload.replace("0x", ""), "hex").toString("base64"),
    //     encoderName: "evm",
    //     signingAlgo: "ecdsa",
    //     hashingAlgo: "keccak256",
    //   }).result();

    //   await evmClient.writeReport(runtime, {
    //     receiver: cfg.receiverAddress,
    //     report,
    //     gasConfig: { gasLimit: cfg.gasLimit },
    //   }).result();

    //   return `LIQUIDATED: ${targetToLiquidate}`;
    // }
    // 4. Output consensus decision
    if (targetToLiquidate) {
      console.log(`🚨 [CRE ENGINE] DANGER DETECTED: ${targetToLiquidate}`);

      // A. Fetch Account Info (Collateral & Debt)
      const accCall = encodeFunctionData({ abi: getAccountAbi, functionName: "getAccountInfo", args: [targetToLiquidate as Address]});
      const accRes = await evmClient.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: accCall }) }).result();
      const [collateral, debt] = decodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], bytesToHex(new Uint8Array(accRes.data as any))) as [bigint, bigint];

     
      const oracleCall = encodeFunctionData({ abi: oracleAbi, functionName: "getLatestPrice" });
      const oracleRes = await evmClient.callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.oracle, data: oracleCall }) }).result();
      const [price8] = decodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], bytesToHex(new Uint8Array(oracleRes.data as any))) as [bigint, bigint];
      const price18 = price8 * 10n**10n; // Scale to 18 decimals

      // C. THE CRE ALGEBRA: Compute Optimal Repay for HF = 1.02
      const collValue = (collateral * price18) / 10n**18n;
      
      let optimalRepay = 0n;
      const numerator = (10200n * debt) - (8500n * collValue);
      
      if (numerator > 0n) {
        optimalRepay = numerator / 1275n;
      }

      // Cap at maximum debt (Triggers Full Liquidation if deep in the Dead Zone)
      if (optimalRepay > debt) {
         optimalRepay = debt;
      }

      console.log(`   ├─ Computed Optimal Repay: ${Number(optimalRepay) / 1e18} NL`);

      // D. Encode the dynamic payload
      const payload = encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }],
        [targetToLiquidate as Address, optimalRepay]
      );

      const report = await runtime.report({
        encodedPayload: Buffer.from(payload.replace("0x", ""), "hex").toString("base64"),
        encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256",
      }).result();

      await evmClient.writeReport(runtime, {
        receiver: cfg.receiverAddress, report, gasConfig: { gasLimit: cfg.gasLimit },
      }).result();

      return `LIQUIDATED: ${targetToLiquidate} for ${optimalRepay}`;
    }

    return `All ${uniqueBorrowers.size} borrowers are solvent.`;
  });

  return [onTick];
}

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}