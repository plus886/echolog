import type { APIRoute } from "astro";

import { getEnv } from "@/lib/env";
import { listTweets } from "@/lib/microcms";

// 旧 app/sitemap.ts の Astro 移植。Next.js の MetadataRoute.Sitemap が
// JSON DSL でフォーマットを自動生成するのに対し、Astro では生 XML を
// 自前で組み立てる。

export const prerender = false;

const SITEMAP_LIMIT = 100;

type Entry = {
  url: string;
  lastModified: Date;
  changeFrequency:
    | "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
};

function entryToXml(e: Entry): string {
  return [
    "  <url>",
    `    <loc>${escapeXml(e.url)}</loc>`,
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

  let tweetEntries: Entry[] = [];
  try {
    const { contents } = await listTweets({
      limit: SITEMAP_LIMIT,
      orders: "-publishedAt",
      fields: "id,publishedAt,revisedAt",
    });
    tweetEntries = contents
      .filter((tweet) => Boolean(tweet.publishedAt))
      .map((tweet) => ({
        url: `${base}/tweets/${tweet.id}`,
        lastModified: tweet.revisedAt
          ? new Date(tweet.revisedAt)
          : new Date(tweet.publishedAt),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
  } catch (e) {
    console.error("sitemap fetch failed", e);
  }

  const entries: Entry[] = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...tweetEntries,
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(entryToXml),
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
