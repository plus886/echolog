import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";

import { MAX_IMAGES, MAX_TWEET_LENGTH } from "@/lib/constants";
import {
  createDay,
  fetchDaysSchema,
  updateDay,
  uploadFormosaMedia,
} from "@/lib/formosa-management";
import { listDays, listTweets } from "@/lib/microcms";
import {
  createTweet,
  deleteTweet,
  hasExistingRetweet,
  updateTweet,
  type TweetWriteFields,
} from "@/lib/microcms-management";
import { matchCameraAndLens } from "@/lib/photo-match";
import { generatePassages } from "@/lib/photo-passage";
import { translateToZh } from "@/lib/translate";
import { suggestTweet as generateTweetSuggestion } from "@/lib/tweet-suggest";
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

// 本文があれば台湾繁體中文へ翻訳する。翻訳が失敗したら ActionError を
// throw し、呼び出し側の createTweet には到達させない (= 投稿しない)。
// 本文が空 (画像のみ投稿) のときは翻訳をスキップして undefined を返す。
async function translateForPost(body: string): Promise<string | undefined> {
  if (body.trim().length === 0) return undefined;
  try {
    return await translateToZh(body);
  } catch (e) {
    console.error("[translate] failed", e);
    throw new ActionError({
      code: "INTERNAL_SERVER_ERROR",
      message: "翻訳に失敗しました。時間をおいて再投稿してください",
    });
  }
}

function buildContent(input: {
  body: string;
  bodyZh?: string;
  parent?: string;
  retweetOf?: string;
  images?: { url: string }[];
}): TweetWriteFields {
  const content: TweetWriteFields = { body: input.body };
  if (input.bodyZh) content.bodyZh = input.bodyZh;
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

// ツイート提案で文体サンプルとして読む過去ツイートの件数。
const TWEET_SAMPLE_COUNT = 40;

// ---- 写真投稿 (formosa / days) ----

// 写真は tweet 画像 (5MB) より大きいので上限を緩める。
const PHOTO_MAX_BYTES = 25 * 1024 * 1024;
const PHOTO_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function assertValidPhoto(file: File) {
  if (!PHOTO_ALLOWED_MIME.has(file.type)) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "対応していない画像形式です (JPEG / PNG / WebP)",
    });
  }
  if (file.size > PHOTO_MAX_BYTES) {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "画像サイズが大きすぎます (上限 25MB)",
    });
  }
}

// バックフィル 1 チャンクあたりの処理件数 (= Claude vision の並列数)。
const BACKFILL_CHUNK = 3;

// passage 削除 1 チャンクの件数。Claude 呼び出し無しの PATCH のみなので
// バックフィルより大きく取れる。
const CLEAR_CHUNK = 25;

// 文章生成に使うモデル種別 (admin のラジオで選択。既定 Opus)。
const PassageModelInput = z.enum(["opus", "sonnet"]).default("opus");

// date は EXIF 撮影日 (ISO) を想定。空・不正なら投稿日 (今日) にする。
function resolvePhotoDate(raw?: string): string {
  const trimmed = raw?.trim();
  if (trimmed) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// microCMS の書き込み API は秒間レート制限があり、まとめて叩くと 429
// (Too many requests) を返す。429 のときだけ指数バックオフで再試行し、
// それ以外のエラーは即 throw する。
async function updateDayWithRetry(
  contentId: string,
  content: { passageJa?: string; passageZh?: string; featured?: boolean },
): Promise<void> {
  const MAX_RETRY = 5;
  for (let attempt = 0; ; attempt++) {
    try {
      await updateDay(contentId, content);
      return;
    } catch (e) {
      const is429 = e instanceof Error && e.message.includes("429");
      if (!is429 || attempt >= MAX_RETRY) throw e;
      await sleep(1000 * 2 ** attempt); // 1s, 2s, 4s, 8s, 16s
    }
  }
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

      const bodyZh = await translateForPost(body);

      const { id } = await createTweet(
        buildContent({ body, bodyZh, parent, retweetOf, images }),
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

      const bodyZh = await translateForPost(body);

      const { id } = await createTweet(
        buildContent({ body, bodyZh, parent, retweetOf, images }),
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
      // 台湾華語訳。admin の手編集で日本語とは独立に書き換えられる
      // (編集時の自動再翻訳はしない)。
      bodyZh: z.string().max(10_000).optional().default(""),
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
        { body: input.body, bodyZh: input.bodyZh },
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

  // 過去ツイートをサンプルに、新しいツイートの下書きを 1 件提案する。
  // mood: 初回は「今の気分」、再生成時は前回下書きへの調整指示 (任意)。
  // previousDraft: 直前に生成した下書き。あれば調整モードで生成する。
  // モデルは Sonnet 固定。投稿はしない (下書き文字列を返すだけ)。
  suggestTweet: defineAction({
    input: z.object({
      mood: z.string().max(2000).optional(),
      previousDraft: z.string().max(10_000).optional(),
    }),
    handler: async ({ mood, previousDraft }) => {
      let samples: string[];
      try {
        // RT / 引用 RT は声のサンプルにならないので除外し、本文のある
        // 自分のツイートだけを新しい順に集める。
        const page = await listTweets({
          filters: "retweetOf[not_exists]",
          orders: "-publishedAt",
          fields: "body",
          limit: TWEET_SAMPLE_COUNT,
        });
        samples = page.contents
          .map((t) => t.body?.trim())
          .filter((b): b is string => Boolean(b));
      } catch (e) {
        console.error("[tweet-suggest] sample fetch failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "過去のツイートの取得に失敗しました",
        });
      }

      if (samples.length === 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "文体の参考にできる過去のツイートがありません",
        });
      }

      try {
        const text = await generateTweetSuggestion({
          samples,
          mood: mood?.trim() || undefined,
          previousDraft: previousDraft?.trim() || undefined,
        });
        return { text };
      } catch (e) {
        console.error("[tweet-suggest] generation failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "ツイートの生成に失敗しました。時間をおいて再試行してください",
        });
      }
    },
  }),

  // ---- 写真投稿タブ (formosa / days) ----

  // days スキーマ (camera / lens の選択肢) を取得。写真タブを開いた時に呼ぶ。
  fetchDaysSchema: defineAction({
    handler: async () => {
      try {
        return await fetchDaysSchema();
      } catch (e) {
        console.error("[photo] schema fetch failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "フィールド情報の取得に失敗しました",
        });
      }
    },
  }),

  // EXIF から得た camera / lens 文字列を選択肢へ対応づける (Claude 推論)。
  matchPhotoExif: defineAction({
    input: z.object({
      cameraExif: z.string().optional(),
      lensExif: z.string().optional(),
      cameraOptions: z.array(z.string()).min(1),
      lensOptions: z.array(z.string()),
    }),
    handler: async (input) => {
      try {
        return await matchCameraAndLens(input);
      } catch (e) {
        console.error("[photo] exif match failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "EXIF からの判定に失敗しました",
        });
      }
    },
  }),

  // 写真を formosa にアップロード → Claude vision で文章生成 → days に作成。
  // 文章生成が失敗したら ActionError を throw し createDay に到達させない
  // (= 投稿しない。写真と文章は常に揃える)。
  publishPhoto: defineAction({
    accept: "form",
    input: z.object({
      image: z.instanceof(File),
      camera: z.string().min(1),
      lens: z.string().optional(),
      date: z.string().optional(),
      model: PassageModelInput,
      // 文章生成時に Claude へ渡す留意事項 (任意)。
      notes: z.string().max(2000).optional(),
    }),
    handler: async (input) => {
      assertValidPhoto(input.image);

      let imageUrl: string;
      try {
        ({ url: imageUrl } = await uploadFormosaMedia(input.image));
      } catch (e) {
        console.error("[photo] media upload failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "画像のアップロードに失敗しました。microCMS の API キーにメディアのアップロード権限があるかご確認ください",
        });
      }

      let passages: { passageJa: string; passageZh: string };
      try {
        passages = await generatePassages(imageUrl, input.model, input.notes);
      } catch (e) {
        console.error("[photo] passage generation failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "文章の生成に失敗しました。時間をおいて再試行してください",
        });
      }

      let id: string;
      try {
        ({ id } = await createDay({
          imageUrl,
          camera: input.camera,
          lens: input.lens?.trim() || undefined,
          passageJa: passages.passageJa,
          passageZh: passages.passageZh,
          date: resolvePhotoDate(input.date),
        }));
      } catch (e) {
        console.error("[photo] createDay failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "投稿の作成に失敗しました。microCMS の API キーに days への POST 権限があるかご確認ください",
        });
      }
      return {
        id,
        imageUrl,
        passageJa: passages.passageJa,
        passageZh: passages.passageZh,
      };
    },
  }),

  // ---- 既存写真への passage 一括バックフィル ----

  // days の件数を返す。remaining = passageJa が空の件数 (未生成)、
  // total = 全件数 (全件刷新の対象数)。パネルが mount 時に呼ぶ。
  photoBackfillStatus: defineAction({
    handler: async () => {
      try {
        const [missing, all] = await Promise.all([
          listDays({
            filters: "passageJa[not_exists]",
            fields: "id",
            limit: 1,
          }),
          listDays({ fields: "id", limit: 1 }),
        ]);
        return { remaining: missing.totalCount, total: all.totalCount };
      } catch (e) {
        console.error("[photo-backfill] status failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "件数の取得に失敗しました",
        });
      }
    },
  }),

  // 未生成 days を 1 チャンク (BACKFILL_CHUNK 件) 処理する。client が offset
  // を進めながら done になるまで繰り返し呼ぶ。1 件の失敗はチャンク全体を
  // 止めない (passageJa が空のまま残り、再実行で拾い直せる)。
  backfillPhotoPassages: defineAction({
    input: z.object({
      offset: z.number().int().min(0).default(0),
      model: PassageModelInput,
    }),
    handler: async ({ offset, model }) => {
      let page;
      try {
        page = await listDays({
          filters: "passageJa[not_exists]",
          orders: "date",
          fields: "id,image",
          limit: BACKFILL_CHUNK,
          offset,
        });
      } catch (e) {
        console.error("[photo-backfill] list failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "未生成の写真の取得に失敗しました",
        });
      }

      const totalRemaining = page.totalCount;
      const chunk = page.contents;
      if (chunk.length === 0) {
        return { processed: 0, failed: 0, totalRemaining, done: true };
      }

      const results = await Promise.allSettled(
        chunk.map(async (day) => {
          const passages = await generatePassages(day.image.url, model);
          await updateDayWithRetry(day.id, passages);
        }),
      );
      let processed = 0;
      let failed = 0;
      for (const r of results) {
        if (r.status === "fulfilled") {
          processed += 1;
        } else {
          failed += 1;
          console.error("[photo-backfill] item failed", r.reason);
        }
      }
      return { processed, failed, totalRemaining, done: false };
    },
  }),

  // 全 days の passage (passageJa / passageZh) を空にする (削除)。
  // Claude 呼び出し無しの PATCH のみ。フィルタ無しの offset ページング。
  clearPhotoPassages: defineAction({
    input: z.object({ offset: z.number().int().min(0).default(0) }),
    handler: async ({ offset }) => {
      let page;
      try {
        page = await listDays({
          orders: "date",
          fields: "id",
          limit: CLEAR_CHUNK,
          offset,
        });
      } catch (e) {
        console.error("[photo-clear] list failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "写真の取得に失敗しました",
        });
      }

      const total = page.totalCount;
      const chunk = page.contents;
      if (chunk.length === 0) {
        return { processed: 0, failed: 0, total, done: true };
      }

      // 削除は Claude 呼び出しが無く一気に書き込めてしまうため、microCMS
      // のレート制限 (429) に当たりやすい。並列化せず順次 + 間隔を空けて
      // 書き込み、429 は updateDayWithRetry がバックオフ再試行する。
      let processed = 0;
      let failed = 0;
      for (const day of chunk) {
        try {
          await updateDayWithRetry(day.id, { passageJa: "", passageZh: "" });
          processed += 1;
        } catch (e) {
          failed += 1;
          console.error("[photo-clear] item failed", e);
        }
        await sleep(300);
      }
      return {
        processed,
        failed,
        total,
        done: offset + chunk.length >= total,
      };
    },
  }),

  // ---- days 一覧管理 (文章管理タブ) ----

  // days を 1 ページ分取得する。一覧表示用。favorite でお気に入り
  // (featured) 状態の絞り込みができる。id を渡すとその ID 1 件だけを
  // 引く (favorite / ページングは無視。完全一致)。
  listDaysPage: defineAction({
    input: z.object({
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(30),
      favorite: z.enum(["all", "featured", "unfeatured"]).default("all"),
      id: z.string().max(200).optional(),
    }),
    handler: async ({ offset, limit, favorite, id }) => {
      const fields = "id,image,passageJa,passageZh,featured,date";
      const searchId = id?.trim();
      try {
        if (searchId) {
          // ID 検索: ids クエリで完全一致 1 件を引く (見つからなければ空)。
          const page = await listDays({ ids: searchId, fields, limit: 1 });
          return { days: page.contents, total: page.totalCount };
        }
        // featured は boolean。未設定エントリも「未featured」に含めたいので
        // unfeatured は [not_equals]true で表現する。
        const filters =
          favorite === "featured"
            ? "featured[equals]true"
            : favorite === "unfeatured"
              ? "featured[not_equals]true"
              : undefined;
        const page = await listDays({
          offset,
          limit,
          // アップロード順 (新しい投稿が先頭)。date フィールド (EXIF 撮影
          // 日時) で並べると、過去日付の写真を後から投稿したときに先頭に
          // 来ないので、ここでは投稿時刻 (publishedAt) を基準にする。
          orders: "-publishedAt",
          fields,
          ...(filters ? { filters } : {}),
        });
        return { days: page.contents, total: page.totalCount };
      } catch (e) {
        console.error("[days] list page failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "一覧の取得に失敗しました",
        });
      }
    },
  }),

  // お気に入り (featured) トグルの保存。
  setDayFeatured: defineAction({
    input: z.object({ id: z.string().min(1), featured: z.boolean() }),
    handler: async ({ id, featured }) => {
      try {
        await updateDayWithRetry(id, { featured });
        return { id, featured };
      } catch (e) {
        console.error("[days] setFeatured failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "お気に入りの更新に失敗しました",
        });
      }
    },
  }),

  // 1 件の写真の文章 (passageJa / passageZh) を手入力で上書き保存する。
  // Claude 呼び出し無し。空文字も許可する (一覧で「（未生成）」になる)。
  updateDayPassages: defineAction({
    input: z.object({
      id: z.string().min(1),
      passageJa: z.string().max(2000),
      passageZh: z.string().max(2000),
    }),
    handler: async ({ id, passageJa, passageZh }) => {
      const next = { passageJa: passageJa.trim(), passageZh: passageZh.trim() };
      try {
        await updateDayWithRetry(id, next);
        return next;
      } catch (e) {
        console.error("[days] update passages failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "文章の保存に失敗しました",
        });
      }
    },
  }),

  // 1 件の写真の文章を生成する。プレビュー用で microCMS には保存しない
  // (保存は採用時に updateDayPassages で別途行う)。生成失敗時は ActionError。
  generateDayPassage: defineAction({
    input: z.object({
      imageUrl: z.string().url(),
      notes: z.string().max(2000).optional(),
      model: PassageModelInput,
    }),
    handler: async ({ imageUrl, notes, model }) => {
      try {
        return await generatePassages(imageUrl, model, notes);
      } catch (e) {
        console.error("[days] generate passage failed", e);
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "文章の生成に失敗しました。時間をおいて再試行してください",
        });
      }
    },
  }),
};
