import {
  EVMClient,
  HTTPClient,
  Runner,
  bytesToHex,
  consensusMedianAggregation,
  encodeCallMsg,
  getNetwork,
  handler,
  hexToBase64,
  json,
  ok,
  cre,
  type Runtime,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk"

import {
  decodeAbiParameters,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toBytes,
  zeroAddress,
  type Address,
  type Hex,
} from "viem"

import {
  BorrowGateAbi,
  BorrowApprovalRegistryAbi,
  LendingPoolAbi,
} from "../contracts/abi/index.js"

type Config = {
  chainSelectorName: string
  borrowGateAddress: Address
  lendingPoolAddress: Address
  registryAddress: Address
  receiverAddress: Address

  riskApiUrl: string

  minFearGreed: number
  minHfAfterE18: string
  maxLtvBps: number
  maxBorrowAmountWei: string

  enableGemini: boolean
  geminiModel: string

  gasLimit: string
}

type EVMLog = {
  topics: Uint8Array[]
  data: Uint8Array
}

const HF_ONE = 10n ** 18n
const PCT_BASE = 100n

function clampUint16(x: bigint): number {
  if (x < 0n) return 0
  if (x > 65535n) return 65535
  return Number(x)
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let out = ""
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out +=
      alphabet[(n >> 18) & 63] +
      alphabet[(n >> 12) & 63] +
      alphabet[(n >> 6) & 63] +
      alphabet[n & 63]
  }
  const rem = bytes.length - i
  if (rem === 1) {
    const n = bytes[i] << 16
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + "=="
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63] + "="
  }
  return out
}

/**
 * Risk API: Alternative.me Fear & Greed
 * Returns -1 on failure (fail-closed).
 */
function fetchFearGreed(send: HTTPSendRequester, url: string): number {
  const resp = send
    .sendRequest({
      url,
      method: "GET",
      timeout: "7s",
      cacheSettings: { readFromCache: true, maxAgeMs: 60_000 },
    })
    .result()

  if (resp.statusCode !== 200) return -1

  try {
    const body = json(resp) as any
    const v = Number(body?.data?.[0]?.value ?? -1)
    if (!Number.isFinite(v) || v < 0 || v > 100) return -1
    return Math.trunc(v)
  } catch {
    return -1
  }
}

function extractJson(text: string): any | null {
  const s = text.indexOf("{")
  const e = text.lastIndexOf("}")
  if (s === -1 || e === -1 || e <= s) return null
  try {
    return JSON.parse(text.slice(s, e + 1))
  } catch {
    return null
  }
}

/**
 * Gemini returns advisory riskScoreBp [0..10000].
 * Returns 0 on any failure (advisory only).
 */
function fetchGeminiRiskScore(
  send: HTTPSendRequester,
  apiKey: string,
  model: string,
  prompt: string
): number {
  const modelPath = model.startsWith("models/") ? model : `models/${model}`
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
    },
  }

  const bodyBytes = new TextEncoder().encode(JSON.stringify(payload))
  const resp = send
    .sendRequest({
      url,
      method: "POST",
      timeout: "12s",
      headers: { "Content-Type": "application/json" },
      body: bytesToBase64(bodyBytes),
      cacheSettings: { readFromCache: true, maxAgeMs: 60_000 },
    })
    .result()

  if (resp.statusCode !== 200) return 0

  try {
    const body = json(resp) as any
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== "string") return 0
    const parsed = extractJson(text)
    if (!parsed) return 0
    const score = Number(parsed?.riskScoreBp ?? 0)
    if (!Number.isFinite(score) || score < 0 || score > 10000) return 0
    return Math.trunc(score)
  } catch {
    return 0
  }
}

function initWorkflow(config: Config) {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  })

  if (!network) {
    throw new Error(`Network not found: ${config.chainSelectorName}`)
  }

 const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
const httpClient = new cre.capabilities.HTTPClient();

  const BORROW_REQUESTED_SIG = "BorrowRequested(uint256,address,bytes32,uint256)"
  const topic0 = keccak256(toBytes(BORROW_REQUESTED_SIG))

  // Always base64 encode for deployed workflows (simulator may accept hex, but prod requires base64)
  // https://docs.chain.link/cre/guides/workflow/using-triggers/evm-log-trigger-ts
  const trigger = evmClient.logTrigger({
    addresses: [hexToBase64(config.borrowGateAddress)],
    topics: [{ values: [hexToBase64(topic0)] }],
  })

  const onLog = handler(trigger, (runtime: Runtime<Config>, log: EVMLog) => {
    const cfg = runtime.config

    // --- Decode event: requestId, borrower, nullifier indexed; amount in data
    const requestId = BigInt(bytesToHex(log.topics[1]))
    const borrower = bytesToHex(log.topics[2].slice(12)) as Address
    const nullifier = bytesToHex(log.topics[3]) as `0x${string}`
    //const [amount] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(log.data)) as [bigint]

    // --- Read BorrowGate.requests(requestId) to confirm still pending
    const reqCall = encodeFunctionData({
      abi: BorrowGateAbi,
      functionName: "requests",
      args: [requestId],
    })

    const reqRes = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: cfg.borrowGateAddress,
          data: reqCall,
        }),
      })
      .result()

    const [reqBorrower, reqAmount, reqNullifier, executed] = decodeFunctionResult({
      abi: BorrowGateAbi,
      functionName: "requests",
      data: bytesToHex(reqRes.data),
    }) as [Address, bigint, Hex, boolean]

    // If already executed or mismatch (shouldn't happen), do nothing.
    if (executed || reqBorrower.toLowerCase() !== borrower.toLowerCase() || reqNullifier.toLowerCase() !== nullifier.toLowerCase()) {
      return ok("Request invalid/stale; skipping").result()
    }

    // --- If registry already decided, no-op (prevents revert on duplicate processing)
    const decidedCall = encodeFunctionData({
      abi: BorrowApprovalRegistryAbi,
      functionName: "isDecided",
      args: [nullifier],
    })

    const decidedRes = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: cfg.registryAddress,
          data: decidedCall,
        }),
      })
      .result()

    const [alreadyDecided] = decodeFunctionResult({
      abi: BorrowApprovalRegistryAbi,
      functionName: "isDecided",
      data: bytesToHex(decidedRes.data),
    }) as [boolean]

    if (alreadyDecided) {
      return ok("Already decided; skipping").result()
    }

    // --- Read LendingPool context
    const collValueCall = encodeFunctionData({
      abi: LendingPoolAbi,
      functionName: "collateralValueOf",
      args: [borrower],
    })
    const debtCall = encodeFunctionData({
      abi: LendingPoolAbi,
      functionName: "tokenDebt",
      args: [borrower],
    })
    const liqThrCall = encodeFunctionData({
      abi: LendingPoolAbi,
      functionName: "liquidationThreshold",
      args: [],
    })
    const hfNowCall = encodeFunctionData({
      abi: LendingPoolAbi,
      functionName: "HealthFactor",
      args: [borrower],
    })

    const collValue = decodeFunctionResult({
      abi: LendingPoolAbi,
      functionName: "collateralValueOf",
      data: bytesToHex(
        evmClient
          .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: collValueCall }) })
          .result().data
      ),
    }) as bigint

    const debt = decodeFunctionResult({
      abi: LendingPoolAbi,
      functionName: "tokenDebt",
      data: bytesToHex(
        evmClient
          .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: debtCall }) })
          .result().data
      ),
    }) as bigint

    const liqThr = decodeFunctionResult({
      abi: LendingPoolAbi,
      functionName: "liquidationThreshold",
      data: bytesToHex(
        evmClient
          .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: liqThrCall }) })
          .result().data
      ),
    }) as bigint

    const hfNow = decodeFunctionResult({
      abi: LendingPoolAbi,
      functionName: "HealthFactor",
      data: bytesToHex(
        evmClient
          .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: hfNowCall }) })
          .result().data
      ),
    }) as bigint

    const debtAfter = debt + reqAmount

    // Compute hfAfter with same formula pattern as your LendingPool
    // hf = (collValue * liqThr * 1e18) / (debtAfter * 100)
    const hfAfter =
      debtAfter === 0n
        ? (2n ** 256n - 1n)
        : (collValue * liqThr * HF_ONE) / (debtAfter * PCT_BASE)

    const ltvBpsBig = collValue === 0n ? 65535n : (debtAfter * 10000n) / collValue
    const ltvBps = clampUint16(ltvBpsBig)

    // --- External risk API (median consensus)
    const fearGreed = httpClient
      .sendRequest(runtime, fetchFearGreed, consensusMedianAggregation<number>())(cfg.riskApiUrl)
      .result()

    // --- Gemini (median consensus), advisory only
    let riskScoreBp = 0
    if (cfg.enableGemini) {
      const apiKey = runtime.getSecret({ id: "GEMINI_API_KEY" }).result().value

      const prompt = [
        "You are a deterministic risk scoring function.",
        "Return ONLY JSON.",
        "",
        "Schema:",
        '{ "riskScoreBp": number }',
        "",
        "Inputs:",
        `fearGreed=${fearGreed}`,
        `hfNowE18=${hfNow.toString()}`,
        `hfAfterE18=${hfAfter.toString()}`,
        `ltvBpsAfter=${ltvBps}`,
        `borrowAmountWei=${reqAmount.toString()}`,
        "",
        "Rules:",
        "- riskScoreBp must be an integer in [0,10000].",
        "- Higher score = higher risk.",
      ].join("\n")

      riskScoreBp = httpClient
        .sendRequest(runtime, fetchGeminiRiskScore, consensusMedianAggregation<number>())(apiKey, cfg.geminiModel, prompt)
        .result()
    }

    // --- Deterministic decision (LLM not safety-critical)
    const minHfAfter = BigInt(cfg.minHfAfterE18)
    const maxBorrowAmount = BigInt(cfg.maxBorrowAmountWei)

    let approved = true
    let reasonCode = 0

    if (fearGreed < 0) {
      approved = false
      reasonCode = 5
    } else if (fearGreed < cfg.minFearGreed) {
      approved = false
      reasonCode = 1
    } else if (hfAfter < minHfAfter) {
      approved = false
      reasonCode = 2
    } else if (BigInt(ltvBps) > BigInt(cfg.maxLtvBps)) {
      approved = false
      reasonCode = 3
    } else if (reqAmount > maxBorrowAmount) {
      approved = false
      reasonCode = 4
    }

    // --- Encode report payload for receiver: abi.encode(bytes32,bool,uint8,uint16,uint16)
    const payload = encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bool" },
        { type: "uint8" },
        { type: "uint16" },
        { type: "uint16" },
      ],
      [nullifier, approved, reasonCode, clampUint16(BigInt(riskScoreBp)), ltvBps]
    )

    const report = runtime
      .report({
        encodedPayload: hexToBase64(payload),
        encoderName: "evm",
        signingAlgo: "ecdsa",
        hashingAlgo: "keccak256",
      })
      .result()

    // --- Write report onchain (forwarder -> receiver.onReport(metadata, report))
    evmClient
      .writeReport(runtime, {
        receiver: cfg.receiverAddress,
        report,
        gasConfig: { gasLimit: cfg.gasLimit },
      })
      .result()

    return ok(
      `Decision: ${approved ? "APPROVE" : "REJECT"} reason=${reasonCode} fearGreed=${fearGreed} ltvBps=${ltvBps} riskScoreBp=${riskScoreBp}`
    ).result()
  })

  return [onLog]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

// main().catch((e) => {
//   // eslint-disable-next-line no-console
//   console.error(e)
//   process.exit(1)
// })
