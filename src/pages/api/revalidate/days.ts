import type { APIRoute } from "astro";

import { getEnv } from "@/lib/env";
import { json } from "@/lib/http";
import { verifyMicroCMSWebhook } from "@/lib/webhook";

// formosa-chiaroscuro /days webhook。HMAC 検証 → ack 応答。
//
// /days の更新はホームの gallery にだけ影響する。即時 purge は phase 6 で
// 対応予定 (下記 TODO)。現状は Cache-Control の TTL に委ねる。

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const verified = await verifyMicroCMSWebhook(
    request,
    getEnv().FORMOSA_MICROCMS_WEBHOOK_SECRET,
  );
  if (!verified.ok) return verified.response;

  // TODO (phase 6): Cloudflare Cache API で "/" のキャッシュを purge する。
  // 現状は Cache-Control の TTL (s-maxage=3600) で自然 invalidation。

  return json({ revalidated: true });
};
