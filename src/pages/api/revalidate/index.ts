import type { APIRoute } from "astro";

import { getEnv } from "@/lib/env";
import { json } from "@/lib/http";
import { verifyMicroCMSWebhook } from "@/lib/webhook";

// 旧 app/api/revalidate/route.ts (microCMS tweets webhook) の Astro 移植。
// HMAC 検証 → payload 解釈 → ack 応答。即時の cache purge は phase 6 で対応。
// 認証は middleware の matcher 外 (webhook は外部から HMAC で叩くため
// Cloudflare Access ゲートに含めない設計、旧版と同じ)。

export const prerender = false;

type WebhookPayload = {
  service?: string;
  api?: string;
  id?: string;
  type?: string;
  contents?: {
    new?: { id?: string; publishValue?: { parent?: { id?: string } | null } };
    old?: { id?: string };
  };
};

export const POST: APIRoute = async ({ request }) => {
  const verified = await verifyMicroCMSWebhook(
    request,
    getEnv().MICROCMS_WEBHOOK_SECRET,
  );
  if (!verified.ok) return verified.response;

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(verified.body) as WebhookPayload;
  } catch {
    return json({ error: "invalid json" }, { status: 400 });
  }

  const tweetId =
    payload.id ?? payload.contents?.new?.id ?? payload.contents?.old?.id;
  const parentId = payload.contents?.new?.publishValue?.parent?.id ?? null;

  return json({
    revalidated: true,
    tweetId: tweetId ?? null,
    parentId,
  });
};
