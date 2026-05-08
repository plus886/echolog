import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { MAX_TWEET_LENGTH } from "@/lib/constants";
import { deleteTweet, updateTweet } from "@/lib/microcms-management";
import { evaluateTweetText } from "@/lib/tweet-text";

type Params = { id: string };

const PatchSchema = z.object({
  body: z.string().max(10_000).optional(),
  isDraft: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<Params> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing-id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-input", issues: parsed.error.format() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.body !== undefined) {
    const status = evaluateTweetText(input.body);
    if (status.isOver) {
      return NextResponse.json(
        { error: "body-too-long", limit: MAX_TWEET_LENGTH },
        { status: 400 },
      );
    }
  }

  try {
    await updateTweet(
      id,
      input.body !== undefined ? { body: input.body } : {},
      input.isDraft !== undefined ? { isDraft: input.isDraft } : undefined,
    );

    revalidatePath("/feed");
    revalidatePath("/");
    revalidatePath(`/tweets/${id}`);

    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: "update-failed", message: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "missing-id" }, { status: 400 });
  }

  try {
    await deleteTweet(id);
    revalidatePath("/feed");
    revalidatePath("/");
    revalidatePath(`/tweets/${id}`);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json(
      { error: "delete-failed", message: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
}
