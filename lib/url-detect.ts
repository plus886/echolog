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
