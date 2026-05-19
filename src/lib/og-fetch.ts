import { parseOgp, type OgpData } from "@/lib/og-parse";
import { isPublicHttpUrl } from "@/lib/url-detect";

// 指定 URL の HTML を取得して OGP を抽出する server 専用関数。
// API ルート (/api/og-preview) と SSR ページ (tweets/[id]) の双方が使う。
// 取得不可・非 HTML・非公開ホスト・タイムアウトは null を返す
// (呼び出し側はカード非表示にフォールバックする)。

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024; // 1MB

export async function fetchOgp(target: string): Promise<OgpData | null> {
  if (!isPublicHttpUrl(target)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "echolog-og-preview/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) return null;

    const buffer = await readLimited(res, MAX_BYTES);
    const html = new TextDecoder().decode(buffer);
    const headEnd = html.toLowerCase().indexOf("</head>");
    const headOnly = headEnd >= 0 ? html.slice(0, headEnd + 7) : html;
    return parseOgp(headOnly, res.url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// レスポンスボディを最大 max バイトまで読む (巨大ページの取り込み防止)。
async function readLimited(res: Response, max: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  reader.cancel().catch(() => {});
  const result = new Uint8Array(Math.min(total, max));
  let offset = 0;
  for (const chunk of chunks) {
    const room = result.byteLength - offset;
    if (room <= 0) break;
    result.set(chunk.subarray(0, room), offset);
    offset += Math.min(room, chunk.byteLength);
  }
  return result;
}
