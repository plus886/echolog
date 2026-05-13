import type { APIRoute } from "astro";

import { getEnv } from "@/lib/env";
import { verifyMicroCMSWebhook } from "@/lib/webhook";

// 旧 app/api/revalidate/days/route.ts (formosa-chiaroscuro days webhook)
// の Astro 移植。HMAC 検証 + ホーム再生成 (現状 stub)。
//
// /days の更新はホームの gallery にだけ影響するため revalidate 対象は
// シンプル ("/" のみ)。stub 関数 lib/revalidate.ts に同種を作る価値も
// 薄いので本ファイル内では特に何もしない。

export const prerender = false;

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

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
