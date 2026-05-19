import { getEnv } from "@/lib/env";

// Anthropic Messages API を raw fetch で叩く共通クライアント。
// translate / photo-passage / tweet-suggest / photo-match が共有する。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。
// client component には絶対にバンドルしない。

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 15_000;

// system プロンプトの 1 ブロック。cache_control を付けるとプロンプト
// キャッシュ対象になる (1024 トークン未満なら実質 inert・害なし)。
export type SystemBlock = {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
};

export type AnthropicMessage = {
  role: "user" | "assistant";
  // テキストのみは string、画像入り (vision) は content ブロックの配列。
  content: string | unknown[];
};

export type CallAnthropicOptions = {
  model: string;
  system: SystemBlock[];
  messages: AnthropicMessage[];
  maxTokens: number;
  timeoutMs?: number;
  // 例外メッセージの接頭辞 (例 "translate failed")。呼び出し側の
  // エラーハンドリングが文言に依存するため、各 lib が従来値を渡す。
  errorLabel: string;
};

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
};

// system プロンプト 1 本を ephemeral cache 付きの text ブロック配列にする。
export function cachedSystem(text: string): SystemBlock[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

// Anthropic Messages API を呼び、最初の text ブロックを trim して返す。
// HTTP エラー・タイムアウト・空応答は errorLabel を接頭辞にした Error を
// throw する (呼び出し側で処理を中断する)。
export async function callAnthropic(
  opts: CallAnthropicOptions,
): Promise<string> {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(`${opts.errorLabel}: ANTHROPIC_API_KEY is not set`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: opts.messages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${opts.errorLabel}: ${res.status} ${detail}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    if (!text) {
      throw new Error(`${opts.errorLabel}: empty response`);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
