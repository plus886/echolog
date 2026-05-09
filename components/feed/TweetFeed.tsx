import Link from "next/link";

import { TweetCard } from "@/components/feed/TweetCard";
import { FEED_PAGE_SIZE } from "@/lib/constants";
import { listRootTweets, listTweets } from "@/lib/microcms";

type Props = {
  limit?: number;
  showHeader?: boolean;
};

export async function TweetFeed({
  limit = FEED_PAGE_SIZE,
  showHeader = true,
}: Props) {
  const { contents } = await listRootTweets({
    limit,
    orders: "-publishedAt",
  });
  const tweets = contents.filter((t) => Boolean(t.publishedAt));

  // どの親ツイートにリプライが存在するかを 1 クエリで集計してバッジ表示する。
  const repliedRootIds = await collectRepliedRootIds(tweets.map((t) => t.id));

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
            <li key={tweet.id} className="flex flex-col gap-1">
              <TweetCard tweet={tweet} />
              {repliedRootIds.has(tweet.id) && (
                <p className="pl-1 text-xs text-muted">
                  <Link
                    href={`/tweets/${tweet.id}`}
                    prefetch={false}
                    className="hover:underline"
                  >
                    スレッドを表示 →
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function collectRepliedRootIds(
  rootIds: string[],
): Promise<Set<string>> {
  if (rootIds.length === 0) return new Set();
  // microCMS の filters では parent[equals]<id>[or]parent[equals]<id>... を作って
  // 親 ID リストに合致する子（= リプライ）のみを取りに行く。
  const filters = rootIds
    .map((id) => `parent[equals]${id}`)
    .join("[or]");
  const { contents } = await listTweets({
    filters,
    fields: "id,parent",
    depth: 1,
    limit: 100,
  });
  const ids = new Set<string>();
  for (const c of contents) {
    if (c.parent?.id) ids.add(c.parent.id);
  }
  return ids;
}
