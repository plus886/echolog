import { getEnv } from "@/lib/env";
import {
  PASSAGE_SYSTEM_PROMPT,
  PASSAGE_USER_INSTRUCTION,
} from "@/lib/photo-passage-prompt";

// アップロードした写真から日本語 (passageJa) と台湾繁體中文 (passageZh) の
// 短い散文キャプションを生成する server 専用モジュール。Anthropic Messages
// API を raw fetch で叩く (vision: 画像入力あり)。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// vision はテキストのみより遅いので翻訳 (15s) より長めに取る。
const TIMEOUT_MS = 25_000;

// admin 側のラジオで選ぶモデル種別。実 model ID への対応はここで集約。
export type PassageModel = "opus" | "sonnet";
const MODEL_IDS: Record<PassageModel, string> = {
  opus: "claude-opus-4-7",
  sonnet: "claude-sonnet-4-6",
};

export type Passages = {
  passageJa: string;
  passageZh: string;
};

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
};

// 写真の URL と使用モデルを受け取り passageJa / passageZh を生成して返す。
// notes: 単発投稿時にオーナーが渡す留意事項 (例「写っているのは妻と義母」)。
// あれば user メッセージに補足として添える (system プロンプトには触れない
// ので cache_control の prefix は不変)。
// HTTP エラー・タイムアウト・空応答・JSON パース失敗・どちらかの passage
// が空のときは例外を throw する (呼び出し側で投稿を中断する)。
export async function generatePassages(
  imageUrl: string,
  model: PassageModel,
  notes?: string,
): Promise<Passages> {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("photo-passage failed: ANTHROPIC_API_KEY is not set");
  }

  // microCMS の画像 API 変換でリサイズ版を Claude に渡す。高解像度の原本
  // (Leica M11 等) をそのまま送らずリクエストサイズを抑える。
  const visionUrl = `${imageUrl}?w=1024&fm=webp`;

  const trimmedNotes = notes?.trim();
  const userText = trimmedNotes
    ? `${PASSAGE_USER_INSTRUCTION}\n\n【この写真についての補足 (投稿者から)】\n${trimmedNotes}`
    : PASSAGE_USER_INSTRUCTION;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_IDS[model],
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: PASSAGE_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "url", url: visionUrl },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`photo-passage failed: ${res.status} ${detail}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    if (!text) {
      throw new Error("photo-passage failed: empty response");
    }

    const parsed = JSON.parse(text) as {
      passageJa?: unknown;
      passageZh?: unknown;
    };
    const passageJa =
      typeof parsed.passageJa === "string" ? parsed.passageJa.trim() : "";
    const passageZh =
      typeof parsed.passageZh === "string" ? parsed.passageZh.trim() : "";
    if (!passageJa || !passageZh) {
      throw new Error("photo-passage failed: incomplete passages");
    }
    return { passageJa, passageZh };
  } finally {
    clearTimeout(timeout);
  }
}
