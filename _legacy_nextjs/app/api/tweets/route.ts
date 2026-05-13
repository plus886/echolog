import { NextResponse } from "next/server";
import { z } from "zod";

import { MAX_IMAGES, MAX_TWEET_LENGTH } from "@/lib/constants";
import { createTweet } from "@/lib/microcms-management";
import { revalidateTweetPaths } from "@/lib/revalidate";
import { evaluateTweetText } from "@/lib/tweet-text";

const PostSchema = z.object({
  body: z.string().max(10_000).optional().default(""),
  parent: z.string().min(1).optional(),
  retweetOf: z.string().min(1).optional(),
  retweetType: z.enum(["retweet", "quote"]).optional(),
  images: z
    .array(z.object({ url: z.string().url() }))
    .max(MAX_IMAGES)
    .optional()
    .default([]),
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

  // body は retweet (コメントなし RT) のときのみ任意。それ以外は本文か画像が必要。
  const isCommentlessRT = input.retweetType === "retweet";
  if (!isCommentlessRT) {
    const hasContent = input.body.trim().length > 0 || input.images.length > 0;
    if (!hasContent) {
      return NextResponse.json({ error: "body-required" }, { status: 400 });
    }
    if (input.body) {
      const status = evaluateTweetText(input.body);
      if (status.isOver) {
        return NextResponse.json(
          { error: "body-too-long", limit: MAX_TWEET_LENGTH },
          { status: 400 },
        );
      }
    }
  }

  try {
    const { id } = await createTweet(
      {
        body: input.body || undefined,
        parent: input.parent,
        retweetOf: input.retweetOf,
        retweetType: input.retweetType ? [input.retweetType] : undefined,
        images: input.images.length > 0 ? input.images : undefined,
      },
      { isDraft: input.isDraft ?? false },
    );

    revalidateTweetPaths(id, {
      parent: input.parent,
      retweetOf: input.retweetOf,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "create-failed", message: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
}
