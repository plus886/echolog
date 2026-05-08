import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { MAX_TWEET_LENGTH } from "@/lib/constants";
import { createTweet } from "@/lib/microcms-management";
import { evaluateTweetText } from "@/lib/tweet-text";

const PostSchema = z.object({
  body: z.string().max(10_000),
  parent: z.string().min(1).optional(),
  retweetOf: z.string().min(1).optional(),
  retweetType: z.enum(["retweet", "quote"]).optional(),
  isDraft: z.boolean().optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-input", issues: parsed.error.format() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.parent && input.retweetOf) {
    return NextResponse.json(
      { error: "parent-and-retweet-mutually-exclusive" },
      { status: 400 },
    );
  }

  if (input.body || (input.retweetType ?? "quote") !== "retweet") {
    if (!input.body.trim()) {
      return NextResponse.json({ error: "body-required" }, { status: 400 });
    }
    const status = evaluateTweetText(input.body);
    if (status.isOver) {
      return NextResponse.json(
        { error: "body-too-long", limit: MAX_TWEET_LENGTH },
        { status: 400 },
      );
    }
  }

  try {
    const { id } = await createTweet(
      {
        body: input.body || undefined,
        parent: input.parent,
        retweetOf: input.retweetOf,
        retweetType: input.retweetType ? [input.retweetType] : undefined,
      },
      { isDraft: input.isDraft ?? false },
    );

    revalidatePath("/feed");
    revalidatePath("/");
    revalidatePath(`/tweets/${id}`);
    if (input.parent) revalidatePath(`/tweets/${input.parent}`);

    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "create-failed", message: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
}
