import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { listTweets } from "@/lib/microcms";

// 親・リプライ含む公開ツイートを sitemap に含める。
// microCMS の `limit` クエリは最大 100。100 件超えてからは offset でのページネーション
// 実装に切り替える（現時点では個人運用で 100 件超は当面ない想定）。
const SITEMAP_LIMIT = 100;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const now = new Date();

  let tweetEntries: MetadataRoute.Sitemap = [];
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

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...tweetEntries,
  ];
}
