// 本文からプレビュー対象の URL を 1 つだけ抽出する。
// 複数 URL がある場合は最初の 1 つに絞る（spec 5.3 でリンクプレビューは
// compose 時のみで、複数並べる UI は今のところ持たない）。
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

export function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  if (!match) return null;
  // 末尾の句読点を除く（例: "https://example.com." の末尾 . を落とす）
  return match[0].replace(/[.,!?)]+$/, "");
}

export type TextSegment =
  | { type: "text"; value: string }
  | { type: "url"; value: string };

// 本文を「テキスト」と「URL」のセグメント列に分解する。本文の自動リンク用。
// URL 末尾の句読点はリンクに含めず、続くテキストセグメントへ回す。
export function splitByUrls(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  // g 付き正規表現は lastIndex を持ち回るので、呼び出しごとに生成する。
  const re = /https?:\/\/[^\s<>"']+/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const trimmed = match[0].replace(/[.,!?)]+$/, "");
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }
    segments.push({ type: "url", value: trimmed });
    // リンクは trimmed までで終わり。落とした句読点を取りこぼさないよう、
    // 次の探索開始位置を trimmed の直後へ戻す。
    lastIndex = match.index + trimmed.length;
    re.lastIndex = lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

const PRIVATE_HOST_BLOCKLIST = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^\[::1\]$/,
];

const PRIVATE_RANGE_172 = (host: string) => {
  const m = host.match(/^172\.(\d+)\./);
  if (!m) return false;
  const second = Number(m[1]);
  return second >= 16 && second <= 31;
};

export function isPublicHttpUrl(input: string): boolean {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname;
  if (!host) return false;
  if (PRIVATE_HOST_BLOCKLIST.some((re) => re.test(host))) return false;
  if (PRIVATE_RANGE_172(host)) return false;
  return true;
}
