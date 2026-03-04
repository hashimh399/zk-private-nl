// import type { HTTPSendRequester } from "@chainlink/cre-sdk";
// import { parseJsonBody, extractJson, safeSnippet, bytesToBase64 } from "./utils";

// export function fetchFearGreed(send: HTTPSendRequester, url: string): number {
//   const resp = send
//     .sendRequest({
//       url,
//       method: "GET",
//       timeout: "7s",
//       headers: { Accept: "application/json" },
//     })
//     .result();

//   if (resp.statusCode !== 200) return -1;

//   try {
//     const body = parseJsonBody(resp);
//     const v = Number(body?.data?.[0]?.value ?? -1);
//     if (!Number.isFinite(v) || v < 0 || v > 100) return -1;
//     return Math.trunc(v);
//   } catch {
//     return -1;
//   }
// }

// function extractFirstJsonObject(text: string): any | null {
//   // remove code fences if present
//   const cleaned = text
//     .replace(/```json/gi, "")
//     .replace(/```/g, "")
//     .trim();

//   // find first JSON object block
//   const start = cleaned.indexOf("{");
//   if (start === -1) return null;

//   // naive brace matching (good enough for simple JSON)
//   let depth = 0;
//   for (let i = start; i < cleaned.length; i++) {
//     const ch = cleaned[i];
//     if (ch === "{") depth++;
//     else if (ch === "}") depth--;

//     if (depth === 0) {
//       const candidate = cleaned.slice(start, i + 1);
//       try {
//         return JSON.parse(candidate);
//       } catch {
//         return null;
//       }
//     }
//   }
//   return null;
// }

// export function fetchGeminiRiskScoreWithDebug(
//   send: HTTPSendRequester,
//   apiKey: string,
//   model: string,
//   prompt: string
// ): { score: number; status: number; snippet: string } {
//   const modelPath = model.startsWith("models/") ? model : `models/${model}`;
//   const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

//   const payload = {
//     contents: [{ role: "user", parts: [{ text: prompt }] }],
//     generationConfig: {
//       temperature: 0,
//       maxOutputTokens: 256,
//       // IMPORTANT: remove responseMimeType to avoid weird structured outputs
//       // responseMimeType: "application/json",
//     },
//   };

//   const bodyBytes = new TextEncoder().encode(JSON.stringify(payload));

//   const resp = send
//     .sendRequest({
//       url,
//       method: "POST",
//       timeout: "12s",
//       headers: { "Content-Type": "application/json" },
//       body: bytesToBase64(bodyBytes),
//     })
//     .result();

//   let score = 0;
//   let snippet = "";

//   try {
//     // 1) Always decode the raw HTTP body first
//     const rawBytes = getRespBodyBytes(resp);
//     const rawText = new TextDecoder().decode(rawBytes);

//     // show we got the full thing (first 1000 chars)
//     snippet = safeSnippet(rawText, 1000);

//     if (resp.statusCode !== 200) {
//       return { score: 0, status: resp.statusCode ?? 0, snippet };
//     }

//     // 2) Parse the HTTP body as JSON (Gemini API response wrapper)
//     const body = JSON.parse(rawText);

//     // 3) Extract ALL parts text (if present)
//     const parts = body?.candidates?.[0]?.content?.parts;
//     const partCount = Array.isArray(parts) ? parts.length : 0;

//     const modelText = Array.isArray(parts)
//       ? parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("")
//       : "";

//     // Prefer snippet from modelText if it exists
//     if (typeof modelText === "string" && modelText.trim().length > 0) {
//       snippet = `parts=${partCount} ` + safeSnippet(modelText, 1000);
//     } else {
//       snippet = `parts=${partCount} RAW=` + safeSnippet(rawText, 900);
//     }

//     // 4) Parse riskScoreBp from modelText (robust)
//     const parsed = extractFirstJsonObject(modelText);
//     const s = Number(parsed?.riskScoreBp ?? 0);
//     if (Number.isFinite(s) && s >= 0 && s <= 10000) score = Math.trunc(s);

//     return { score, status: resp.statusCode ?? 0, snippet };
//   } catch {
//     return { score: 0, status: resp.statusCode ?? 0, snippet };
//   }
// }


import {
  ok,
  text,
  json,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import { bytesToBase64, safeSnippet } from "./utils";

function extractFirstJsonObject(text: string): any | null {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;

    if (depth === 0) {
      const candidate = cleaned.slice(start, i + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function fetchFearGreed(send: HTTPSendRequester, url: string): number {
  const resp = send
    .sendRequest({
      url,
      method: "GET",
      timeout: "7s",
      headers: { Accept: "application/json" },
    })
    .result();

  if (!ok(resp)) return -1;

  try {
    const body = json(resp) as any;
    const v = Number(body?.data?.[0]?.value ?? -1);
    if (!Number.isFinite(v) || v < 0 || v > 100) return -1;
    return Math.trunc(v);
  } catch {
    return -1;
  }
}

export function fetchGeminiRiskScoreWithDebug(
  send: HTTPSendRequester,
  apiKey: string,
  model: string,
  prompt: string
): { score: number; status: number } {
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 512,
    },
  };

  const bodyBytes = new TextEncoder().encode(JSON.stringify(payload));

  const resp = send
    .sendRequest({
      url,
      method: "POST",
      timeout: "12s",
      headers: { "Content-Type": "application/json" },
      body: bytesToBase64(bodyBytes),
    })
    .result();

  const status = resp.statusCode ?? 0;

  try {
    const raw = text(resp);
    console.log(`🧠 [Gemini node] status=${status}`);
    console.log(`🧠 [Gemini node] rawBody="${safeSnippet(raw, 800)}"`);

    if (!ok(resp)) {
      return { score: 0, status };
    }

    const body = json(resp) as any;
    const parts = body?.candidates?.[0]?.content?.parts;

    const modelText = Array.isArray(parts)
      ? parts.map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("")
      : "";

    console.log(`🧠 [Gemini node] modelText="${safeSnippet(modelText, 800)}"`);

    const parsed = extractFirstJsonObject(modelText);
    const s = Number(parsed?.riskScoreBp ?? 0);

    if (Number.isFinite(s) && s >= 0 && s <= 10000) {
      return { score: Math.trunc(s), status };
    }

    return { score: 0, status };
  } catch (e: any) {
    console.log(`🧠 [Gemini node] parseError=${String(e?.message ?? e)}`);
    return { score: 0, status };
  }
}