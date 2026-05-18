import { getEnv } from "@/lib/env";
import { MATCH_SYSTEM_PROMPT } from "@/lib/photo-match-prompt";

// 写真の EXIF から得たカメラ名・レンズ名を days スキーマの select 選択肢へ
// 対応づける server 専用モジュール。Anthropic Messages API を raw fetch で
// 叩く (テキストのみ・画像なし)。
//
// 注意: ANTHROPIC_API_KEY を読むため actions / SSR からのみ import する。

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const TIMEOUT_MS = 15_000;

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

type AnthropicResponse = {
  content?: { type: string; text?: string }[];
};

// EXIF 文字列 + 選択肢リストから最も近い camera / lens を推論して返す。
// 返値は必ず「選択肢内の文字列」または null (リスト外の値は null に矯正)。
// HTTP エラー・タイムアウト・空応答・JSON パース失敗は例外を throw する。
export async function matchCameraAndLens(
  input: GearMatchInput,
): Promise<GearMatch> {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("photo-match failed: ANTHROPIC_API_KEY is not set");
  }

  const userContent = JSON.stringify({
    cameraExif: input.cameraExif ?? "",
    lensExif: input.lensExif ?? "",
    cameraOptions: input.cameraOptions,
    lensOptions: input.lensOptions,
  });

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
        max_tokens: 256,
        system: [
          {
            type: "text",
            text: MATCH_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userContent }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`photo-match failed: ${res.status} ${detail}`);
    }

    const data = (await res.json()) as AnthropicResponse;
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    if (!text) {
      throw new Error("photo-match failed: empty response");
    }

    const parsed = JSON.parse(text) as { camera?: unknown; lens?: unknown };
    // モデルが選択肢外の値を返しても安全側に倒す: リスト所属を検証し、
    // 外れていれば null にする。
    const pick = (value: unknown, options: string[]): string | null =>
      typeof value === "string" && options.includes(value) ? value : null;

    return {
      camera: pick(parsed.camera, input.cameraOptions),
      lens: pick(parsed.lens, input.lensOptions),
    };
  } finally {
    clearTimeout(timeout);
  }
}
