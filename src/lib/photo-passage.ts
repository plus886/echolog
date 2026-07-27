import { callAnthropic, cachedSystem } from "@/lib/anthropic";
import {
  PASSAGE_SYSTEM_PROMPT,
  PASSAGE_USER_INSTRUCTION,
} from "@/lib/photo-passage-prompt";

// アップロードした写真から日本語 (passageJa) と台湾繁體中文 (passageZh) の
// 短い散文キャプションを生成する server 専用モジュール。Anthropic 呼び出しは
// lib/anthropic.ts の共通クライアントに委譲する (vision: 画像入力あり)。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。

// admin 側のラジオで選ぶモデル種別。実 model ID への対応はここで集約。
// fable は創作文向けのモデル。短歌・現代詩の生成はまさにその用途なので
// 選択肢に含める (料金は opus の 2 倍: $10/$50 per MTok)。
export type PassageModel = "opus" | "sonnet" | "fable";
const MODEL_IDS: Record<PassageModel, string> = {
  opus: "claude-opus-5",
  sonnet: "claude-sonnet-5",
  fable: "claude-fable-5",
};

// Claude 5 系は既定で extended thinking が有効で、その思考も output トークン
// として max_tokens を消費する。プロンプトが「内部で 3 案生成 → 自己評価」を
// 求めるぶん思考が長く、実測で 1,000〜2,100 tok 使う (旧値 1024 では思考の
// 途中で打ち切られ、本文の JSON が返らなかった)。余裕を見て 4096。
const MAX_TOKENS = 4096;

// 同じ理由で応答も遅い (実測 opus 24s / sonnet 34s / fable 41s)。旧値 25s
// では opus でもタイムアウトしていたので 90s に広げる。await 中の時間は
// Workers の CPU 時間に計上されないので、この待ちは問題にならない。
const TIMEOUT_MS = 90_000;

export type Passages = {
  passageJa: string;
  passageZh: string;
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
  // microCMS の画像 API 変換でリサイズ版を Claude に渡す。高解像度の原本
  // (Leica M11 等) をそのまま送らずリクエストサイズを抑える。
  const visionUrl = `${imageUrl}?w=1024&fm=webp`;

  const trimmedNotes = notes?.trim();
  const userText = trimmedNotes
    ? `${PASSAGE_USER_INSTRUCTION}\n\n【この写真についての補足 (投稿者から)】\n${trimmedNotes}`
    : PASSAGE_USER_INSTRUCTION;

  const text = await callAnthropic({
    model: MODEL_IDS[model],
    system: cachedSystem(PASSAGE_SYSTEM_PROMPT),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: visionUrl } },
          { type: "text", text: userText },
        ],
      },
    ],
    maxTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    errorLabel: "photo-passage failed",
  });

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
}
