import { callAnthropic, cachedSystem } from "@/lib/anthropic";
import { TWEET_SUGGEST_SYSTEM_PROMPT } from "@/lib/tweet-suggest-prompt";

// 過去のツイートをサンプルに、新しいツイートの下書きを 1 件生成する
// server 専用モジュール。Anthropic 呼び出しは lib/anthropic.ts の共通
// クライアントに委譲する。モデルは Sonnet 固定。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。
// client component には絶対にバンドルしない。

const MODEL = "claude-opus-5";

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
  const text = await callAnthropic({
    model: MODEL,
    system: cachedSystem(TWEET_SUGGEST_SYSTEM_PROMPT),
    messages: [{ role: "user", content: buildUserMessage(input) }],
    // 下書き自体は短いが、Claude 5 系は extended thinking の分も
    // max_tokens を消費するので余裕を持たせる (実測 39 tok / 2 秒)。
    maxTokens: 4096,
    timeoutMs: 45_000,
    errorLabel: "tweet-suggest failed",
  });
  return stripWrappingQuotes(text);
}
