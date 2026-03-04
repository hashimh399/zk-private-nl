import {
  Runner,
  bytesToHex,
  consensusMedianAggregation,
  encodeCallMsg,
  getNetwork,
  handler,
  hexToBase64,
  cre,
  type Runtime,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk"

import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toBytes,
  zeroAddress,
  type Address,
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

function getRespBodyBytes(resp: any): Uint8Array {
  const b = resp?.body
  if (!b) return new Uint8Array()
  if (b instanceof Uint8Array) return b
  if (Array.isArray(b)) return new Uint8Array(b)
  if (ArrayBuffer.isView(b) && b.buffer) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength)
  return new Uint8Array()
}

function parseJsonBody(resp: any): any {
  const bodyBytes = getRespBodyBytes(resp)
  const text = new TextDecoder().decode(bodyBytes)
  return JSON.parse(text)
}

/**
 * CRE SDK callContract return shape differs across versions.
 * This safely extracts the ABI-encoded return bytes.
 */
function getReturnBytes(res: any, label: string): Uint8Array {
  const raw = res?.data ?? res?.returnData ?? res?.result?.data ?? res?.result?.returnData

  if (!raw) {
    throw new Error(`${label}: callContract returned no data/returnData`)
  }

  if (raw instanceof Uint8Array) return raw
  if (ArrayBuffer.isView(raw) && raw.buffer) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  if (Array.isArray(raw)) return new Uint8Array(raw)

  throw new Error(`${label}: unsupported return bytes type`)
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
//new patch
function safeSnippet(s: string, max = 180): string {
  const oneLine = s.replace(/\s+/g, " ").trim()
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max) + "…"
}

function fetchGeminiRiskScoreWithDebug(
  send: HTTPSendRequester,
  apiKey: string,
  model: string,
  prompt: string
): { score: number; status: number; snippet: string } {
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
    })
    .result()

  let score = 0
  let snippet = ""

  try {
    if (resp.statusCode === 200) {
      const body = parseJsonBody(resp)
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
      if (typeof text === "string") {
        snippet = safeSnippet(text, 180)
        const parsed = extractJson(text)
        const s = Number(parsed?.riskScoreBp ?? 0)
        if (Number.isFinite(s) && s >= 0 && s <= 10000) score = Math.trunc(s)
      }
    }
  } catch {
    // keep defaults
  }

  return { score, status: resp.statusCode ?? 0, snippet }
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
      headers: { Accept: "application/json" },
    })
    .result()

  if (resp.statusCode !== 200) return -1

  try {
    const body = parseJsonBody(resp)
    const v = Number(body?.data?.[0]?.value ?? -1)
    if (!Number.isFinite(v) || v < 0 || v > 100) return -1
    return Math.trunc(v)
  } catch {
    return -1
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
      body: bytesToBase64(bodyBytes), // CRE HTTP expects base64 body
    })
    .result()

  if (resp.statusCode !== 200) return 0

  try {
    const body = parseJsonBody(resp)
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
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`)

  // IMPORTANT: pass the selector (bigint), not an object
  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
  const httpClient = new cre.capabilities.HTTPClient()

  const BORROW_REQUESTED_SIG = "BorrowRequested(uint256,address,bytes32,uint256)"
  const topic0 = keccak256(toBytes(BORROW_REQUESTED_SIG))

  const trigger = evmClient.logTrigger({
    addresses: [hexToBase64(config.borrowGateAddress)],
    topics: [{ values: [hexToBase64(topic0)] }],
  })

  const onLog = handler(trigger, (runtime: Runtime<Config>, log: EVMLog) => {
    const cfg = runtime.config

    // Decode indexed topics
    const requestId = BigInt(bytesToHex(log.topics[1]))

    const borrowerTopicHex = bytesToHex(log.topics[2]) // 0x + 64 hex chars
    const borrower = ("0x" + borrowerTopicHex.slice(-40)) as Address

    const nullifier = bytesToHex(log.topics[3]) as `0x${string}`

    // --- Read BorrowGate.requests(requestId)
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

    const reqBytes = getReturnBytes(reqRes, "BorrowGate.requests")
    const [reqBorrower, reqAmount, reqNullifier, executed] = decodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bool" },
      ],
      bytesToHex(reqBytes)
    ) as [Address, bigint, `0x${string}`, boolean]

    if (
      executed ||
      reqBorrower.toLowerCase() !== borrower.toLowerCase() ||
      reqNullifier.toLowerCase() !== nullifier.toLowerCase()
    ) {
      return "Request invalid/stale; skipping"
    }

    // --- If already decided, skip
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

    const [alreadyDecided] = decodeAbiParameters(
      [{ type: "bool" }],
      bytesToHex(getReturnBytes(decidedRes, "Registry.isDecided"))
    ) as [boolean]

    if (alreadyDecided) {
      return "Already decided; skipping"
    }

    // --- Read LendingPool context
    let collValue: bigint | null = null
    let debt: bigint | null = null
    let liqThr: bigint | null = null
    let hfNow: bigint | null = null

    try {
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

      const collRes = evmClient
        .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: collValueCall }) })
        .result()
      ;[collValue] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(collRes, "Pool.collateralValueOf"))) as [bigint]

      const debtRes = evmClient
        .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: debtCall }) })
        .result()
      ;[debt] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(debtRes, "Pool.tokenDebt"))) as [bigint]

      const liqRes = evmClient
        .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: liqThrCall }) })
        .result()
      ;[liqThr] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(liqRes, "Pool.liquidationThreshold"))) as [bigint]

      const hfRes = evmClient
        .callContract(runtime, { call: encodeCallMsg({ from: zeroAddress, to: cfg.lendingPoolAddress, data: hfNowCall }) })
        .result()
      ;[hfNow] = decodeAbiParameters([{ type: "uint256" }], bytesToHex(getReturnBytes(hfRes, "Pool.HealthFactor"))) as [bigint]
    } catch (e: any) {
      // This is where your earlier "STALE PRICE" revert happens.
      // Fail closed but still write a REJECT report so the request can be marked decided.
      const approved = false
      const reasonCode = 6 // Onchain context read failed (e.g., oracle stale)

      const payload = encodeAbiParameters(
        [
          { type: "bytes32" },
          { type: "bool" },
          { type: "uint8" },
          { type: "uint16" },
          { type: "uint16" },
        ],
        [nullifier, approved, reasonCode, 0, 65535]
      )

      const report = runtime
        .report({
          encodedPayload: hexToBase64(payload),
          encoderName: "evm",
          signingAlgo: "ecdsa",
          hashingAlgo: "keccak256",
        })
        .result()

      evmClient
        .writeReport(runtime, {
          receiver: cfg.receiverAddress,
          report,
          gasConfig: { gasLimit: cfg.gasLimit },
        })
        .result()

      return `REJECT reason=6 (pool/oracle read failed: ${String(e?.message ?? e)})`
    }

    // At this point we have pool context
    const debtAfter = (debt as bigint) + reqAmount

    const hfAfter =
      debtAfter === 0n
        ? (2n ** 256n - 1n)
        : ((collValue as bigint) * (liqThr as bigint) * HF_ONE) / (debtAfter * PCT_BASE)

    const ltvBpsBig =
      (collValue as bigint) === 0n ? 65535n : (debtAfter * 10000n) / (collValue as bigint)
    const ltvBps = clampUint16(ltvBpsBig)

    // --- External risk API
    const fearGreed = httpClient
      .sendRequest(runtime, fetchFearGreed, consensusMedianAggregation<number>())(cfg.riskApiUrl)
      .result()

    // --- Gemini (optional)
    // let riskScoreBp = 0
    // if (cfg.enableGemini) {
    //   const apiKey = runtime.getSecret({ id: "GEMINI_API_KEY" }).result().value

    //   const prompt = [
    //     "You are a deterministic risk scoring function.",
    //     "Return ONLY JSON.",
    //     "",
    //     "Schema:",
    //     '{ "riskScoreBp": number }',
    //     "",
    //     "Inputs:",
    //     `fearGreed=${fearGreed}`,
    //     `hfNowE18=${(hfNow as bigint).toString()}`,
    //     `hfAfterE18=${hfAfter.toString()}`,
    //     `ltvBpsAfter=${ltvBps}`,
    //     `borrowAmountWei=${reqAmount.toString()}`,
    //     "",
    //     "Rules:",
    //     "- riskScoreBp must be an integer in [0,10000].",
    //     "- Higher score = higher risk.",
    //   ].join("\n")

    //   riskScoreBp = httpClient
    //     .sendRequest(runtime, fetchGeminiRiskScore, consensusMedianAggregation<number>())(apiKey, cfg.geminiModel, prompt)
    //     .result()
    // }
    let riskScoreBp = 0
    let geminiStatus = 0
    let geminiSnippet = ""

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
    `hfNowE18=${(hfNow as bigint).toString()}`,
    `hfAfterE18=${hfAfter.toString()}`,
    `ltvBpsAfter=${ltvBps}`,
    `borrowAmountWei=${reqAmount.toString()}`,
    "",
    "Rules:",
    "- riskScoreBp must be an integer in [0,10000].",
    "- Higher score = higher risk.",
  ].join("\n")

  const g = httpClient
    .sendRequest(runtime, fetchGeminiRiskScoreWithDebug, consensusMedianAggregation<{ score: number; status: number; snippet: string }>())(
      apiKey,
      cfg.geminiModel,
      prompt
    )
    .result()
// const g = httpClient
//   .sendRequest(runtime, fetchGeminiRiskScoreWithDebug, consensusMedianAggregation())(
//     apiKey,
//     cfg.geminiModel,
//     prompt
//   )
//   .result()


  riskScoreBp = g.score
  geminiStatus = g.status
  geminiSnippet = g.snippet
}


    // --- Deterministic decision
    const minHfAfter = BigInt(cfg.minHfAfterE18)
    const maxBorrowAmount = BigInt(cfg.maxBorrowAmountWei)

    let approved = true
    let reasonCode = 0

    if (fearGreed < 0) {
      approved = false
      reasonCode = 5 // risk API failed
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

    // --- Encode report payload for receiver
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

    evmClient
      .writeReport(runtime, {
        receiver: cfg.receiverAddress,
        report,
        gasConfig: { gasLimit: cfg.gasLimit },
      })
      .result()

    //return `Decision=${approved ? "APPROVE" : "REJECT"} reason=${reasonCode} fearGreed=${fearGreed} ltvBps=${ltvBps} riskScoreBp=${riskScoreBp}`
    return `Decision=${approved ? "APPROVE" : "REJECT"} reason=${reasonCode} fearGreed=${fearGreed} ltvBps=${ltvBps} riskScoreBp=${riskScoreBp} geminiStatus=${geminiStatus} gemini="${geminiSnippet}"`

  })

  return [onLog]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
