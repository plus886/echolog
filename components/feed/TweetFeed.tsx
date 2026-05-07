import Link from "next/link";

import { TweetCard } from "@/components/feed/TweetCard";
import { FEED_PAGE_SIZE } from "@/lib/constants";
import { listTweets } from "@/lib/microcms";

type Props = {
  limit?: number;
  showHeader?: boolean;
};

export async function TweetFeed({
  limit = FEED_PAGE_SIZE,
  showHeader = true,
}: Props) {
  const { contents: tweets } = await listTweets({
    limit,
    orders: "-publishedAt",
  });

  return (
    <section className="flex flex-col gap-4">
      {showHeader && (
        <header className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">最新のツイート</h2>
          <Link
            href="/feed"
            prefetch={false}
            className="text-sm text-muted hover:underline"
          >
            すべて見る →
          </Link>
        </header>
      )}

      {tweets.length === 0 ? (
        <p className="text-sm text-muted">まだツイートがありません。</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tweets.map((tweet) => (
            <li key={tweet.id}>
              <TweetCard tweet={tweet} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
