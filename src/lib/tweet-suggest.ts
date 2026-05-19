import { getEnv } from "@/lib/env";
import { TWEET_SUGGEST_SYSTEM_PROMPT } from "@/lib/tweet-suggest-prompt";

// 過去のツイートをサンプルに、新しいツイートの下書きを 1 件生成する
// server 専用モジュール。Anthropic Messages API を raw fetch で叩く。
// モデルは Sonnet 固定。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。
// client component には絶対にバンドルしない。

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 20_000;

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
};

export type SuggestTweetInput = {
  // 文体参考にする過去のツイート本文 (新しい順)。
  samples: string[];
  // 初回生成: 今の気分・書きたいこと。再生成: 前回への調整指示。任意。
  mood?: string;
  // 再生成のとき、直前に生成した下書き。あれば調整モードになる。
  previousDraft?: string;
};

// サンプル・気分・前回下書きを 1 通の user メッセージに組み立てる。
function buildUserMessage(input: SuggestTweetInput): string {
  const sampleBlock = input.samples
    .map((s) => `- ${s.replace(/\s*\n\s*/g, " ")}`)
    .join("\n");

  const parts: string[] = [
    "【過去のツイート（文体の参考。模倣せず、声・長さ・話題の幅を掴む）】",
    "",
    sampleBlock,
    "",
  ];

  const mood = input.mood?.trim();
  const prev = input.previousDraft?.trim();

  if (prev) {
    parts.push("【前回の下書き】", prev, "");
    parts.push(
      "【調整の指示（前回の下書きへのフィードバック）】",
      mood ||
        "（特に指示なし。前回とは別の角度でもう 1 案を出してください。）",
      "",
    );
  } else {
    parts.push(
      "【今の気分・書きたいこと】",
      mood ||
        "（特に指定なし。過去のツイートの幅から自然な 1 件を書いてください。）",
      "",
    );
  }

  parts.push(
    "上記を踏まえ、新しいツイートの下書きを 1 件だけ、本文のみで出力してください。",
  );
  return parts.join("\n");
}

// モデルが指示に反して本文を引用符で包んだ場合、1 層だけ外す保険。
function stripWrappingQuotes(text: string): string {
  const pairs: [string, string][] = [
    ['"', '"'],
    ["'", "'"],
    ["「", "」"],
    ["『", "』"],
    ["“", "”"],
  ];
  for (const [open, close] of pairs) {
    if (text.length >= 2 && text.startsWith(open) && text.endsWith(close)) {
      return text.slice(1, -1).trim();
    }
  }
  return text;
}

// 過去ツイートのサンプルから新しいツイートの下書きを 1 件生成して返す。
// HTTP エラー・タイムアウト・空応答はいずれも例外を throw する。
export async function suggestTweet(input: SuggestTweetInput): Promise<string> {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("tweet-suggest failed: ANTHROPIC_API_KEY is not set");
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
        max_tokens: 1024,
        system: [
          {
            type: "text",
            text: TWEET_SUGGEST_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: buildUserMessage(input) }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`tweet-suggest failed: ${res.status} ${detail}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    if (!text) {
      throw new Error("tweet-suggest failed: empty response");
    }
    return stripWrappingQuotes(text);
  } finally {
    clearTimeout(timeout);
  }
}
