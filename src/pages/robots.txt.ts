import type { APIRoute } from "astro";

import { getEnv } from "@/lib/env";

// 旧 app/robots.ts の Astro 移植。Next.js の MetadataRoute.Robots が
// JSON 形式の DSL なのに対し、Astro は素朴に robots.txt のテキストを
// Response として返す形が一般的。

export const prerender = false;

export const GET: APIRoute = () => {
  const base = getEnv().PUBLIC_SITE_URL.replace(/\/$/, "");
  const body = [
    "User-agent: *",
    "Allow: /",
    "Allow: /tweets/",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /api/",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
};
