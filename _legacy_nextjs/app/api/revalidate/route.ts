import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { revalidateTweetPaths } from "@/lib/revalidate";
import { verifyMicroCMSWebhook } from "@/lib/webhook";

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

export async function POST(request: Request) {
  const verified = await verifyMicroCMSWebhook(
    request,
    env.MICROCMS_WEBHOOK_SECRET,
  );
  if (!verified.ok) return verified.response;

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(verified.body) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const tweetId =
    payload.id ?? payload.contents?.new?.id ?? payload.contents?.old?.id;
  const parentId = payload.contents?.new?.publishValue?.parent?.id ?? null;

  revalidateTweetPaths(tweetId ?? undefined, {
    parent: parentId ?? undefined,
  });

  return NextResponse.json({
    revalidated: true,
    tweetId: tweetId ?? null,
    parentId,
  });
}
