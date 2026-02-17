// workflows/zkpass-borrow-risk/risk.ts
import {
  cre,
  ok,
  consensusIdenticalAggregation,
  type Runtime,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import type { Config } from "./types";

type FearGreedApi = {
  data?: Array<{ value?: string }>;
};

export function fetchFearGreedIndex(runtime: Runtime<Config>): number {
  const httpClient = new cre.capabilities.HTTPClient();

  // Return only the final numeric "value" so consensus is stable even if other JSON fields vary.
  const fg: number = httpClient
    .sendRequest(
      runtime,
      getFearGreed(runtime.config.riskApiUrl),
      consensusIdenticalAggregation<number>(),
    )(runtime.config)
    .result();

  return fg;
}

const getFearGreed =
  (url: string) =>
  (sendRequester: HTTPSendRequester, _config: Config): number => {
    const req = {
      url,
      method: "GET" as const,
      headers: {
        Accept: "application/json",
      },
      cacheSettings: {
        readFromCache: true,
        maxAgeMs: 60_000,
      },
    };

    const resp = sendRequester.sendRequest(req).result();
    const bodyText = new TextDecoder().decode(resp.body);
    if (!ok(resp)) {
      throw new Error(`FearGreed API failed: ${resp.statusCode} body=${bodyText}`);
    }

    const parsed = JSON.parse(bodyText) as FearGreedApi;
    const valueStr = parsed?.data?.[0]?.value;
    const v = Number(valueStr);

    if (!Number.isFinite(v) || v < 0 || v > 100) {
      throw new Error(`FearGreed API malformed value: ${String(valueStr)}`);
    }
    return v;
  };
