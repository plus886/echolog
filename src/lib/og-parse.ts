// HTML <head> から og:* / twitter:* と <title> を抜き出す。
// 軽量自前実装（依存 0）。spec で要求されているのは compose プレビュー用途の最低限。

export type OgpData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

const META_TAG_REGEX = /<meta\b([^>]*?)\/?>/gi;
const TITLE_TAG_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const ATTR_REGEX = /([a-zA-Z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

function parseAttrs(input: string): Record<string, string> {
  const result: Record<string, string> = {};
  let match: RegExpExecArray | null;
  ATTR_REGEX.lastIndex = 0;
  while ((match = ATTR_REGEX.exec(input)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? "";
    result[name] = decodeHtmlEntities(value);
  }
  return result;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

export function parseOgp(html: string, baseUrl: string): OgpData {
  const meta: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = META_TAG_REGEX.exec(html)) !== null) {
    const attrs = parseAttrs(m[1]);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (!key || !attrs.content) continue;
    if (!(key in meta)) meta[key] = attrs.content;
  }

  const titleMatch = html.match(TITLE_TAG_REGEX);
  const fallbackTitle = titleMatch
    ? decodeHtmlEntities(titleMatch[1].trim())
    : null;

  const image = pickAbsolute(
    meta["og:image"] ?? meta["twitter:image"] ?? null,
    baseUrl,
  );

  return {
    url: meta["og:url"] ?? baseUrl,
    title: meta["og:title"] ?? meta["twitter:title"] ?? fallbackTitle,
    description: meta["og:description"] ?? meta["twitter:description"] ?? null,
    image,
    siteName: meta["og:site_name"] ?? null,
  };
}

function pickAbsolute(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}
