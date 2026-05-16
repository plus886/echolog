import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

import { MAX_IMAGES, MAX_TWEET_LENGTH } from "@/lib/constants";
import {
  createTweet,
  deleteTweet,
  hasExistingRetweet,
  updateTweet,
  type TweetWriteFields,
} from "@/lib/microcms-management";
import { evaluateTweetText } from "@/lib/tweet-text";

// `accept: "form"` 経由の入力は Astro が FormData → zod を自動でやってくれる。
// 但し空 string ("") は undefined にはならない (.optional() の挙動)。空白
// trim + フォールバックは handler 内で行う。

const ImageSchema = z.object({ url: z.string().url() });
const ImagesArraySchema = z.array(ImageSchema).max(MAX_IMAGES);

function parseImagesField(raw: string | null | undefined): { url: string }[] {
  if (!raw) return [];
  try {
    return ImagesArraySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}

function assertWithinLimit(body: string) {
  const status = evaluateTweetText(body);
  if (status.isOver) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: `本文が ${MAX_TWEET_LENGTH} カウントを超えています`,
    });
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
    // 引用 RT のみ ComposeForm 経由で作成 (コメントなし RT は server.retweet)
    content.retweetType = ["quote"];
  }
  if (input.images && input.images.length > 0) {
    content.images = input.images;
  }
  return content;
}

// compose / draft 共通の input 形。
const ComposeFormInput = z.object({
  body: z.string().max(10_000).optional().default(""),
  parent: z.string().optional(),
  retweetOf: z.string().optional(),
  images: z.string().optional(), // JSON string
});

function normalizeCompose(input: ReturnType<typeof ComposeFormInput.parse>) {
  const parent = input.parent?.trim() || undefined;
  const retweetOf = input.retweetOf?.trim() || undefined;
  const body = input.body ?? "";
  const images = parseImagesField(input.images ?? null);

  if (parent && retweetOf) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "parent と retweetOf は同時に指定できません",
    });
  }
  return { body, parent, retweetOf, images };
}

export const server = {
  publishTweet: defineAction({
    accept: "form",
    input: ComposeFormInput,
    handler: async (input) => {
      const { body, parent, retweetOf, images } = normalizeCompose(input);

      const hasContent = body.trim().length > 0 || images.length > 0;
      if (!hasContent) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "本文か画像を入力してください",
        });
      }
      assertWithinLimit(body);

      const { id } = await createTweet(
        buildContent({ body, parent, retweetOf, images }),
      );
      return { id };
    },
  }),

  saveDraft: defineAction({
    accept: "form",
    input: ComposeFormInput,
    handler: async (input) => {
      const { body, parent, retweetOf, images } = normalizeCompose(input);

      const hasContent = body.trim().length > 0 || images.length > 0;
      if (!hasContent) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "本文か画像を入力してください",
        });
      }
      assertWithinLimit(body);

      const { id } = await createTweet(
        buildContent({ body, parent, retweetOf, images }),
        { isDraft: true },
      );
      return { id };
    },
  }),

  updateTweet: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().min(1),
      body: z.string().max(10_000),
      publish: z.string().optional(), // form は string、後で boolean 化
    }),
    handler: async (input) => {
      if (!input.body.trim()) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "本文を入力してください",
        });
      }
      assertWithinLimit(input.body);
      const publish = input.publish === "true";
      await updateTweet(
        input.id,
        { body: input.body },
        publish ? { isDraft: false } : undefined,
      );
      return { id: input.id };
    },
  }),

  deleteTweet: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async (input) => {
      await deleteTweet(input.id);
      return { id: input.id };
    },
  }),

  // コメントなし RT。即時実行 + 重複チェック。
  retweet: defineAction({
    accept: "form",
    input: z.object({ targetId: z.string().min(1) }),
    handler: async (input) => {
      if (await hasExistingRetweet(input.targetId)) {
        throw new ActionError({
          code: "CONFLICT",
          message: "既にリツイート済みです",
        });
      }
      const { id } = await createTweet({
        retweetOf: input.targetId,
        retweetType: ["retweet"],
      });
      return { id };
    },
  }),
};
