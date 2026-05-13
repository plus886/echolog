import { NextResponse } from "next/server";

import { parseOgp } from "@/lib/og-parse";
import { isPublicHttpUrl } from "@/lib/url-detect";

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024; // 1MB（ヘッドのみ拾えれば十分）

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "missing-url" }, { status: 400 });
  }
  if (!isPublicHttpUrl(url)) {
    return NextResponse.json({ error: "invalid-url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "echolog-og-preview/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      // OGP は変動が緩いので 24h サイドキャッシュを許す
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "upstream-status", status: res.status },
        { status: 502 },
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) {
      return NextResponse.json(
        { error: "non-html-response", contentType },
        { status: 415 },
      );
    }

    const buffer = await readLimited(res, MAX_BYTES);
    const html = new TextDecoder().decode(buffer);
    const headOnly = html.slice(0, html.toLowerCase().indexOf("</head>") + 7);
    const ogp = parseOgp(headOnly || html, res.url);
    return NextResponse.json(ogp);
  } catch (e) {
    return NextResponse.json(
      {
        error: "fetch-failed",
        message: e instanceof Error ? e.message : "",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

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
