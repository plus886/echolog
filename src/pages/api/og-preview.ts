import type { APIRoute } from "astro";

import { json } from "@/lib/http";
import { fetchOgp } from "@/lib/og-fetch";

// 認証は middleware が /api/og-preview を Cloudflare Access JWT で gate。
// admin の compose プレビュー (LinkPreview) が叩く。取得ロジックは
// lib/og-fetch.ts に集約 (SSR の tweets/[id] と共有)。

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get("url");
  if (!target) return json({ error: "missing-url" }, { status: 400 });

  const ogp = await fetchOgp(target);
  if (!ogp) return json({ error: "fetch-failed" }, { status: 502 });

  return json(ogp, {
    headers: {
      // 24h edge cache。同じ URL の連投を Cloudflare 側で吸収する。
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
};
