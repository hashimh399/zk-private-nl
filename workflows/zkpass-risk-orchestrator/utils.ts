export function clampUint16(x: bigint): number {
  if (x < 0n) return 0;
  if (x > 65535n) return 65535;
  return Number(x);
}

export function getRespBodyBytes(resp: any): Uint8Array {
  const b = resp?.body;
  if (!b) return new Uint8Array();
  if (b instanceof Uint8Array) return b;
  if (Array.isArray(b)) return new Uint8Array(b);
  if (ArrayBuffer.isView(b) && b.buffer) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  return new Uint8Array();
}

export function parseJsonBody(resp: any): any {
  const bodyBytes = getRespBodyBytes(resp);
  const text = new TextDecoder().decode(bodyBytes);
  return JSON.parse(text);
}

export function extractJson(text: string): any | null {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1 || e <= s) return null;
  try {
    return JSON.parse(text.slice(s, e + 1));
  } catch {
    return null;
  }
}

export function safeSnippet(s: string, max = 180): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max) + "…";
}

// (kept as-is; CRE HTTP wants base64-encoded body)
export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      alphabet[(n >> 18) & 63] +
      alphabet[(n >> 12) & 63] +
      alphabet[(n >> 6) & 63] +
      alphabet[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + "==";
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      alphabet[(n >> 18) & 63] +
      alphabet[(n >> 12) & 63] +
      alphabet[(n >> 6) & 63] +
      "=";
  }
  return out;
}