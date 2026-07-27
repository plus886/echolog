import { callAnthropic, cachedSystem } from "@/lib/anthropic";

// 日本語ツイート本文を台湾繁體中文へ翻訳する server 専用モジュール。
// Anthropic 呼び出しは lib/anthropic.ts の共通クライアントに委譲する。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する
// こと。client component には絶対にバンドルしない。

const MODEL = "claude-sonnet-5";

// system prompt はリクエスト間で byte 安定 (module-level const)。
const SYSTEM_PROMPT = [
  "あなたは日本語から台湾で使われる繁體中文への翻訳者です。",
  "次のルールを厳守してください:",
  "- 台湾で一般的に使われる繁體中文に訳す (香港繁體の語彙・言い回しは使わない)。",
  "- 絵文字・顔文字・URL・ハッシュタグ (#...)・メンション (@...) は翻訳せず原文のまま残す。",
  "- 台語 (台湾語/閩南語) の単語や固有名詞 (人名・地名・作品名・ブランド名) は原文のまま残す。",
  "- 原文の改行と書式を保持する。空行を足したり削ったりしない。",
  "- 書名・書籍タイトル (『〜』や「〜」で括られた著作物のタイトルを含む) は翻訳せず原文のまま残す。括弧や順序などの書式は一般的な台湾の学術的な引用形式に変換する。",
  "- 出力は翻訳後のテキストのみ。前置き・説明・引用符・注釈を一切付けない。",
].join("\n");

// 日本語 body を台湾繁體中文に翻訳して返す。HTTP エラー・タイムアウト・
// 空応答はいずれも例外を throw する (呼び出し側で投稿を中断する)。
export async function translateToZh(body: string): Promise<string> {
  return callAnthropic({
    model: MODEL,
    system: cachedSystem(SYSTEM_PROMPT),
    messages: [{ role: "user", content: body }],
    // Claude 5 系は extended thinking の分も output トークンを食うため、
    // 本文ぶんに加えて余裕を持たせる (翻訳は実測 40 tok / 3 秒程度)。
    maxTokens: 4000,
    timeoutMs: 30_000,
    errorLabel: "translate failed",
  });
}
