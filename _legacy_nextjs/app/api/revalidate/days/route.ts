import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { verifyMicroCMSWebhook } from "@/lib/webhook";

export async function POST(request: Request) {
  const verified = await verifyMicroCMSWebhook(
    request,
    env.FORMOSA_MICROCMS_WEBHOOK_SECRET,
  );
  if (!verified.ok) return verified.response;

  revalidatePath("/");

  return NextResponse.json({ revalidated: true });
}
