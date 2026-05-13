import type { APIRoute } from "astro";
import { z } from "zod";

import { MAX_TWEET_LENGTH } from "@/lib/constants";
import { deleteTweet, updateTweet } from "@/lib/microcms-management";
import { revalidateTweetPaths } from "@/lib/revalidate";
import { evaluateTweetText } from "@/lib/tweet-text";

// 旧 app/api/tweets/[id]/route.ts (PATCH/DELETE) の Astro 移植。
// Astro では Astro.params が同期で取れる (Next.js の async params 不要)。

export const prerender = false;

const PatchSchema = z.object({
  body: z.string().max(10_000).optional(),
  isDraft: z.boolean().optional(),
});

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

export const PATCH: APIRoute = async ({ request, params }) => {
  const { id } = params;
  if (!id) return json({ error: "missing-id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid-json" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid-input", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.body !== undefined) {
    const status = evaluateTweetText(input.body);
    if (status.isOver) {
      return json(
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
    revalidateTweetPaths(id);
    return json({ id });
  } catch (e) {
    return json(
      { error: "update-failed", message: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return json({ error: "missing-id" }, { status: 400 });

  try {
    await deleteTweet(id);
    revalidateTweetPaths(id);
    return json({ id });
  } catch (e) {
    return json(
      { error: "delete-failed", message: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
};
