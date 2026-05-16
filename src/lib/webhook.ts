// microCMS の signed webhook を検証して raw body を返す共通ヘルパー。
// /api/revalidate (echolog tweets) と /api/revalidate/days (formosa days)
// で同じ仕組み。
//
// Astro 移植版。旧 lib/webhook.ts (NextResponse 使用) を Response 直構築に
// 切替。ロジックは同一。

import { json } from "@/lib/http";

const SIGNATURE_HEADER = "x-microcms-signature";

export type WebhookVerifyResult =
  | { ok: true; body: string }
  | { ok: false; response: Response };

export async function verifyMicroCMSWebhook(
  request: Request,
  secret: string,
): Promise<WebhookVerifyResult> {
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!signature) {
    return {
      ok: false,
      response: json({ error: "missing signature" }, { status: 401 }),
    };
  }

  const rawBody = await request.text();

  if (!(await verifyHmacSha256(rawBody, secret, signature))) {
    return {
      ok: false,
      response: json({ error: "invalid signature" }, { status: 401 }),
    };
  }

  return { ok: true, body: rawBody };
}

async function verifyHmacSha256(
  rawBody: string,
  secret: string,
  signatureHex: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqualHex(expected, signatureHex);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
