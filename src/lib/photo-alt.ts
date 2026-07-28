import { callAnthropic, cachedSystem } from "@/lib/anthropic";
import {
  ALT_SYSTEM_PROMPT,
  buildAltUserMessage,
} from "@/lib/photo-alt-prompt.mjs";
import type { LocationFields } from "@/types/microcms";

// 写真から検索最適化・アクセシビリティ用の代替テキスト (altJa / altZh) を
// 生成する server 専用モジュール。短歌 (photo-passage) と違って創作ではなく
// 事実描写なので、モデルはラジオ選択の対象外で Opus 5 固定。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。

const MODEL = "claude-opus-5";

// Claude 5 系は extended thinking も max_tokens を消費する
// (photo-passage.ts の同名定数のコメント参照)。
const MAX_TOKENS = 4096;
const TIMEOUT_MS = 60_000;

export type AltTexts = { altJa: string; altZh: string };

// 写真の URL を受け取り altJa / altZh を生成して返す。location を渡すと
// 投稿者が確定させた撮影地として alt に含められる (未指定なら地名は一切
// 書かれない)。HTTP エラー・タイムアウト・JSON パース失敗・どちらかが空の
// ときは例外を throw する (呼び出し側で投稿を中断する)。
export async function generateAltTexts(
  imageUrl: string,
  location?: LocationFields,
): Promise<AltTexts> {
  // microCMS の画像 API 変換でリサイズ版を渡す (photo-passage と同じ)。
  const visionUrl = `${imageUrl}?w=1024&fm=webp`;

  const text = await callAnthropic({
    model: MODEL,
    system: cachedSystem(ALT_SYSTEM_PROMPT),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: visionUrl } },
          { type: "text", text: buildAltUserMessage(location) },
        ],
      },
    ],
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    errorLabel: "photo-alt failed",
  });

  const parsed = JSON.parse(text) as { altJa?: unknown; altZh?: unknown };
  const altJa = typeof parsed.altJa === "string" ? parsed.altJa.trim() : "";
  const altZh = typeof parsed.altZh === "string" ? parsed.altZh.trim() : "";
  if (!altJa || !altZh) {
    throw new Error("photo-alt failed: incomplete alt texts");
  }
  return { altJa, altZh };
}
