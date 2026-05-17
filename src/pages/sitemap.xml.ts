import type { APIRoute } from "astro";

import { getEnv } from "@/lib/env";
import { localeUrl, locales } from "@/lib/i18n";
import { listTweets } from "@/lib/microcms";

export const prerender = false;

const SITEMAP_LIMIT = 100;

type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

// locale 中立な論理エントリ。出力時に locale ごとの絶対 URL に展開する。
type LogicalEntry = {
  path: string;
  lastModified: Date;
  changeFrequency: ChangeFreq;
  priority: number;
};

function urlToXml(loc: string, e: LogicalEntry): string {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${e.lastModified.toISOString()}</lastmod>`,
    `    <changefreq>${e.changeFrequency}</changefreq>`,
    `    <priority>${e.priority.toFixed(1)}</priority>`,
    "  </url>",
  ].join("\n");
}

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const GET: APIRoute = async () => {
  const base = getEnv().PUBLIC_SITE_URL.replace(/\/$/, "");
  const now = new Date();

  let tweetEntries: LogicalEntry[] = [];
  try {
    const { contents } = await listTweets({
      limit: SITEMAP_LIMIT,
      orders: "-publishedAt",
      fields: "id,publishedAt,revisedAt",
    });
    tweetEntries = contents
      .filter((tweet) => Boolean(tweet.publishedAt))
      .map((tweet) => ({
        path: `/tweets/${tweet.id}`,
        lastModified: tweet.revisedAt
          ? new Date(tweet.revisedAt)
          : new Date(tweet.publishedAt),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
  } catch (e) {
    console.error("sitemap fetch failed", e);
  }

  const logical: LogicalEntry[] = [
    { path: "/", lastModified: now, changeFrequency: "daily", priority: 1.0 },
    ...tweetEntries,
  ];

  // 各論理エントリを ja / zh 両方の絶対 URL として出力する。
  const urls = logical.flatMap((e) =>
    locales.map((loc) => urlToXml(`${base}${localeUrl(e.path, loc)}`, e)),
  );

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
};
