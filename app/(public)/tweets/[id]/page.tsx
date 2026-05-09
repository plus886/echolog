import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TweetCard } from "@/components/feed/TweetCard";
import { env } from "@/lib/env";
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
  const canonical = `${env.NEXT_PUBLIC_SITE_URL}/tweets/${tweet.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      publishedTime: tweet.publishedAt,
      modifiedTime: tweet.revisedAt,
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

function buildJsonLd(tweet: Tweet) {
  const kind = getRetweetKind(tweet);
  const source = kind === "retweet" && tweet.retweetOf ? tweet.retweetOf : tweet;
  const body = source.body ?? "";
  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": `${env.NEXT_PUBLIC_SITE_URL}/tweets/${tweet.id}`,
    url: `${env.NEXT_PUBLIC_SITE_URL}/tweets/${tweet.id}`,
    datePublished: tweet.publishedAt,
    dateModified: tweet.revisedAt,
    headline: body.slice(0, 100) || "echolog tweet",
    articleBody: body,
    image: source.images?.map((image) => image.url) ?? undefined,
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
        <JsonLd data={buildJsonLd(tweet)} />
      </main>
    );
  }

  // スレッド表示: parent をルート、子リプライを時系列で並べる。
  // 親フェッチとリプライ取得は依存していないので並列化する。
  const rootId = tweet.parent?.id ?? tweet.id;
  const [maybeRoot, repliesResp] = await Promise.all([
    tweet.parent ? fetchTweetOrNull(tweet.parent.id) : Promise.resolve(null),
    listThreadReplies(rootId, { limit: 100 }),
  ]);
  const root: Tweet = maybeRoot ?? tweet;
  const replies = repliesResp.contents;

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
      <JsonLd data={buildJsonLd(tweet)} />
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

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
