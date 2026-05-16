import type { APIRoute } from "astro";

import { json } from "@/lib/http";
import { parseOgp } from "@/lib/og-parse";
import { isPublicHttpUrl } from "@/lib/url-detect";

// 旧 app/api/og-preview/route.ts の Astro 移植。
// 認証は middleware が /api/og-preview を Cloudflare Access JWT で gate。
// 旧版の `next: { revalidate: 86400 }` (Next.js fetch cache) は Astro
// では無効。代替に Cache-Control header を Response に付けて edge cache
// に乗せる。

export const prerender = false;

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024; // 1MB

export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get("url");
  if (!target) return json({ error: "missing-url" }, { status: 400 });
  if (!isPublicHttpUrl(target))
    return json({ error: "invalid-url" }, { status: 400 });

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

    if (!res.ok) {
      return json(
        { error: "upstream-status", status: res.status },
        { status: 502 },
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) {
      return json({ error: "non-html-response", contentType }, { status: 415 });
    }

    const buffer = await readLimited(res, MAX_BYTES);
    const html = new TextDecoder().decode(buffer);
    const headOnly = html.slice(0, html.toLowerCase().indexOf("</head>") + 7);
    const ogp = parseOgp(headOnly || html, res.url);

    return json(ogp, {
      headers: {
        // 24h edge cache (旧 Next.js fetch cache の代替)。同じ URL の連投を
        // Cloudflare の側で吸収する。private content ではないので public で OK。
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
      },
    });
  } catch (e) {
    return json(
      { error: "fetch-failed", message: e instanceof Error ? e.message : "" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
};

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
