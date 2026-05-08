"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { MAX_TWEET_LENGTH } from "@/lib/constants";
import {
  createTweet,
  deleteTweet,
  updateTweet,
  type TweetWriteFields,
} from "@/lib/microcms-management";
import { evaluateTweetText } from "@/lib/tweet-text";

const TweetInputSchema = z.object({
  body: z.string().max(10_000),
  parent: z.string().min(1).optional(),
});

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function assertWithinLimit(body: string) {
  const status = evaluateTweetText(body);
  if (status.isOver) {
    throw new Error(`本文が ${MAX_TWEET_LENGTH} カウントを超えています`);
  }
}

function buildContent(input: {
  body: string;
  parent?: string;
}): TweetWriteFields {
  const content: TweetWriteFields = { body: input.body };
  if (input.parent) content.parent = input.parent;
  return content;
}

function revalidateAfterWrite(id: string, parent?: string) {
  revalidatePath("/feed");
  revalidatePath("/");
  revalidatePath(`/tweets/${id}`);
  if (parent) revalidatePath(`/tweets/${parent}`);
  revalidatePath("/admin");
  revalidatePath("/admin/drafts");
}

export async function publishTweetAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = TweetInputSchema.parse({
      body: formData.get("body") ?? "",
      parent: formData.get("parent") || undefined,
    });
    if (!parsed.body.trim()) {
      return { ok: false, error: "本文を入力してください" };
    }
    assertWithinLimit(parsed.body);

    const { id } = await createTweet(buildContent(parsed));
    revalidateAfterWrite(id, parsed.parent);
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "投稿に失敗しました",
    };
  }
}

export async function saveDraftAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = TweetInputSchema.parse({
      body: formData.get("body") ?? "",
      parent: formData.get("parent") || undefined,
    });
    if (!parsed.body.trim()) {
      return { ok: false, error: "本文を入力してください" };
    }
    assertWithinLimit(parsed.body);

    const { id } = await createTweet(buildContent(parsed), { isDraft: true });
    revalidatePath("/admin/drafts");
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "下書き保存に失敗しました",
    };
  }
}

const UpdateInputSchema = z.object({
  id: z.string().min(1),
  body: z.string().max(10_000),
  publish: z.boolean().optional(),
});

export async function updateTweetAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "");
  const publish = formData.get("publish") === "true";
  const parsed = UpdateInputSchema.parse({ id, body, publish });

  if (!parsed.body.trim()) {
    throw new Error("本文を入力してください");
  }
  assertWithinLimit(parsed.body);

  await updateTweet(
    parsed.id,
    { body: parsed.body },
    parsed.publish ? { isDraft: false } : undefined,
  );
  revalidateAfterWrite(parsed.id);
  redirect("/admin");
}

export async function deleteTweetAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("idが指定されていません");
  await deleteTweet(id);
  revalidatePath("/feed");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/drafts");
  redirect("/admin");
}
