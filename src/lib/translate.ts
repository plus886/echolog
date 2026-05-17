import { getEnv } from "@/lib/env";

// 日本語ツイート本文を台湾繁體中文へ翻訳する server 専用モジュール。
// Anthropic Messages API を raw fetch で叩く (SDK 依存は足さない)。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する
// こと。client component には絶対にバンドルしない。

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 15_000;

// system prompt はリクエスト間で byte 安定 (module-level const)。
// プロンプトキャッシュの最小トークン (~1024) には届かない長さなので
// cache_control は実質 inert だが、害は無く将来プロンプトが伸びれば効く。
const SYSTEM_PROMPT = [
  "あなたは日本語から台湾で使われる繁體中文への翻訳者です。",
  "次のルールを厳守してください:",
  "- 台湾で一般的に使われる繁體中文に訳す (香港繁體の語彙・言い回しは使わない)。",
  "- 絵文字・顔文字・URL・ハッシュタグ (#...)・メンション (@...) は翻訳せず原文のまま残す。",
  "- 台語 (台湾語/閩南語) の単語や固有名詞 (人名・地名・作品名・ブランド名) は原文のまま残す。",
  "- 原文の改行と書式を保持する。空行を足したり削ったりしない。",
  "- 出力は翻訳後のテキストのみ。前置き・説明・引用符・注釈を一切付けない。",
].join("\n");

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
};

// 日本語 body を台湾繁體中文に翻訳して返す。HTTP エラー・タイムアウト・
// 空応答はいずれも例外を throw する (呼び出し側で投稿を中断する)。
export async function translateToZh(body: string): Promise<string> {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("translate failed: ANTHROPIC_API_KEY is not set");
  }

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
        model: MODEL,
        max_tokens: 2000,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: body }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`translate failed: ${res.status} ${detail}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    if (!text) {
      throw new Error("translate failed: empty response");
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
