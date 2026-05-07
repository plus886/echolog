import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

const SIGNATURE_HEADER = "x-microcms-signature";

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

async function verifySignature(rawBody: string, signature: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.MICROCMS_WEBHOOK_SECRET),
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

  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(request: Request) {
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!signature) {
    return NextResponse.json(
      { error: "missing signature" },
      { status: 401 },
    );
  }

  const rawBody = await request.text();

  if (!(await verifySignature(rawBody, signature))) {
    return NextResponse.json(
      { error: "invalid signature" },
      { status: 401 },
    );
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "invalid json" },
      { status: 400 },
    );
  }

  const tweetId =
    payload.id ?? payload.contents?.new?.id ?? payload.contents?.old?.id;
  const parentId =
    payload.contents?.new?.publishValue?.parent?.id ?? null;

  revalidatePath("/feed");
  revalidatePath("/");

  if (tweetId) {
    revalidatePath(`/tweets/${tweetId}`);
  }
  if (parentId) {
    revalidatePath(`/tweets/${parentId}`);
  }

  return NextResponse.json({
    revalidated: true,
    tweetId: tweetId ?? null,
    parentId,
  });
}
