"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { MAX_TWEET_LENGTH } from "@/lib/constants";
import {
  createTweet,
  deleteTweet,
  hasExistingRetweet,
  updateTweet,
  type TweetWriteFields,
} from "@/lib/microcms-management";
import { evaluateTweetText } from "@/lib/tweet-text";

const MAX_IMAGES = 4;

const ImageSchema = z.object({
  url: z.string().url(),
});

const ImagesArraySchema = z
  .array(ImageSchema)
  .max(MAX_IMAGES);

const ComposeSchema = z
  .object({
    body: z.string().max(10_000),
    parent: z.string().min(1).optional(),
    retweetOf: z.string().min(1).optional(),
    images: ImagesArraySchema.default([]),
  })
  .refine((d) => !(d.parent && d.retweetOf), {
    message: "parent と retweetOf は同時に指定できません",
  });

function parseImagesField(raw: FormDataEntryValue | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return ImagesArraySchema.parse(parsed);
  } catch {
    return [];
  }
}

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
  retweetOf?: string;
  images?: { url: string }[];
}): TweetWriteFields {
  const content: TweetWriteFields = { body: input.body };
  if (input.parent) content.parent = input.parent;
  if (input.retweetOf) {
    content.retweetOf = input.retweetOf;
    // 引用 RT のみ ComposeForm 経由で作成される（コメントなし RT は retweetAction）
    content.retweetType = ["quote"];
  }
  if (input.images && input.images.length > 0) {
    content.images = input.images;
  }
  return content;
}

function revalidateAfterWrite(
  id: string,
  refs: { parent?: string; retweetOf?: string } = {},
) {
  revalidatePath("/feed");
  revalidatePath("/");
  revalidatePath(`/tweets/${id}`);
  if (refs.parent) revalidatePath(`/tweets/${refs.parent}`);
  if (refs.retweetOf) revalidatePath(`/tweets/${refs.retweetOf}`);
  revalidatePath("/admin");
  revalidatePath("/admin/drafts");
}

function readCompose(formData: FormData) {
  return ComposeSchema.parse({
    body: formData.get("body") ?? "",
    parent: formData.get("parent") || undefined,
    retweetOf: formData.get("retweetOf") || undefined,
    images: parseImagesField(formData.get("images")),
  });
}

export async function publishTweetAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const parsed = readCompose(formData);
    const hasContent = parsed.body.trim().length > 0 || parsed.images.length > 0;
    if (!hasContent) {
      return { ok: false, error: "本文か画像を入力してください" };
    }
    assertWithinLimit(parsed.body);

    const { id } = await createTweet(buildContent(parsed));
    revalidateAfterWrite(id, parsed);
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
    const parsed = readCompose(formData);
    const hasContent = parsed.body.trim().length > 0 || parsed.images.length > 0;
    if (!hasContent) {
      return { ok: false, error: "本文か画像を入力してください" };
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

// コメントなし RT。即時実行 + 重複チェック。
const RetweetSchema = z.object({
  targetId: z.string().min(1),
});

export async function retweetAction(formData: FormData): Promise<ActionResult> {
  try {
    const { targetId } = RetweetSchema.parse({
      targetId: formData.get("targetId") ?? "",
    });

    if (await hasExistingRetweet(targetId)) {
      return { ok: false, error: "既にリツイート済みです" };
    }

    const { id } = await createTweet({
      retweetOf: targetId,
      retweetType: ["retweet"],
    });
    revalidateAfterWrite(id, { retweetOf: targetId });
    return { ok: true, id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "RT に失敗しました",
    };
  }
}
