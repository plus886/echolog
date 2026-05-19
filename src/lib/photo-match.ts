import { callAnthropic, cachedSystem } from "@/lib/anthropic";
import { MATCH_SYSTEM_PROMPT } from "@/lib/photo-match-prompt";

// 写真の EXIF から得たカメラ名・レンズ名を days スキーマの select 選択肢へ
// 対応づける server 専用モジュール。Anthropic 呼び出しは lib/anthropic.ts の
// 共通クライアントに委譲する (テキストのみ・画像なし)。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。

const MODEL = "claude-sonnet-4-6";

export type GearMatchInput = {
  cameraExif?: string;
  lensExif?: string;
  cameraOptions: string[];
  lensOptions: string[];
};

export type GearMatch = {
  camera: string | null;
  lens: string | null;
};

// EXIF 文字列 + 選択肢リストから最も近い camera / lens を推論して返す。
// 返値は必ず「選択肢内の文字列」または null (リスト外の値は null に矯正)。
// HTTP エラー・タイムアウト・空応答・JSON パース失敗は例外を throw する。
export async function matchCameraAndLens(
  input: GearMatchInput,
): Promise<GearMatch> {
  const userContent = JSON.stringify({
    cameraExif: input.cameraExif ?? "",
    lensExif: input.lensExif ?? "",
    cameraOptions: input.cameraOptions,
    lensOptions: input.lensOptions,
  });

  const text = await callAnthropic({
    model: MODEL,
    system: cachedSystem(MATCH_SYSTEM_PROMPT),
    messages: [{ role: "user", content: userContent }],
    maxTokens: 256,
    timeoutMs: 15_000,
    errorLabel: "photo-match failed",
  });

  const parsed = JSON.parse(text) as { camera?: unknown; lens?: unknown };
  // モデルが選択肢外の値を返しても安全側に倒す: リスト所属を検証し、
  // 外れていれば null にする。
  const pick = (value: unknown, options: string[]): string | null =>
    typeof value === "string" && options.includes(value) ? value : null;

  return {
    camera: pick(parsed.camera, input.cameraOptions),
    lens: pick(parsed.lens, input.lensOptions),
  };
}
