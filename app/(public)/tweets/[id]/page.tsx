import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TweetCard } from "@/components/feed/TweetCard";
import { getTweet, listThreadReplies } from "@/lib/microcms";
import { getRetweetKind, type Tweet } from "@/types/microcms";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { id: string };

const META_TITLE_LENGTH = 40;
const META_DESC_LENGTH = 120;

async function fetchTweetOrNull(id: string) {
  try {
    return await getTweet(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const tweet = await fetchTweetOrNull(id);
  if (!tweet) return { title: "Tweet not found" };

  // RT (retweet) の場合は元ツイート本文をメタにも反映する（B案）
  const kind = getRetweetKind(tweet);
  const sourceBody =
    kind === "retweet" ? tweet.retweetOf?.body ?? "" : tweet.body ?? "";
  const sourceImage =
    (kind === "retweet"
      ? tweet.retweetOf?.images?.[0]?.url
      : tweet.images?.[0]?.url) ?? null;

  const title = sourceBody.slice(0, META_TITLE_LENGTH) || "echolog tweet";
  const description = sourceBody.slice(0, META_DESC_LENGTH) || "echolog tweet";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: sourceImage ? [{ url: sourceImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: sourceImage ? [sourceImage] : undefined,
    },
  };
}

export default async function TweetPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const tweet = await fetchTweetOrNull(id);
  if (!tweet) notFound();

  // コメントなし RT は本文を持たない「ポインタ」なのでスレッドを持たず単独表示する（B 案）。
  // 引用 RT は自分のコメントが本体でスレッドの起点になり得るので通常通りスレッド処理。
  if (getRetweetKind(tweet) === "retweet") {
    return (
      <main className="mx-auto max-w-2xl w-full px-4 py-8 flex flex-col gap-4">
        <BackLink />
        <TweetCard tweet={tweet} detail highlight />
      </main>
    );
  }

  // スレッド表示: parent をルート、子リプライを時系列で並べる。
  // ネストは 1 段のみなので、ルートを 1 度引いて parent[equals]rootId のリプライを取る。
  const root: Tweet = tweet.parent
    ? (await fetchTweetOrNull(tweet.parent.id)) ?? tweet
    : tweet;

  const { contents: replies } = await listThreadReplies(root.id, {
    limit: 100,
  });

  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-8 flex flex-col gap-4">
      <BackLink />
      <TweetCard tweet={root} detail highlight={root.id === tweet.id} />
      {replies.length > 0 && (
        <ol className="flex flex-col gap-3 border-l border-border pl-4">
          {replies.map((reply) => (
            <li key={reply.id}>
              <TweetCard
                tweet={reply}
                detail
                highlight={reply.id === tweet.id}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function BackLink() {
  return (
    <nav className="text-sm text-muted">
      <Link href="/feed" prefetch={false} className="hover:underline">
        ← フィードに戻る
      </Link>
    </nav>
  );
}
