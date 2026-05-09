import Image from "next/image";
import Link from "next/link";

import { formatAbsoluteTimestamp, formatTweetTimestamp } from "@/lib/format";
import {
  getRetweetKind,
  type Tweet,
  type TweetReference,
} from "@/types/microcms";

type Props = {
  tweet: Tweet;
  /** 個別ビューのときのみ true。リスト中ではコンパクトに表示する。 */
  detail?: boolean;
  /** 個別ビューでハイライト対象（=URLに指定された）の場合 true。 */
  highlight?: boolean;
};

export function TweetCard({ tweet, detail = false, highlight = false }: Props) {
  const kind = getRetweetKind(tweet);

  const containerClass = [
    "border rounded-lg p-4 transition-colors",
    highlight ? "border-foreground/40 bg-foreground/[0.03]" : "border-border",
    detail ? "" : "hover:bg-foreground/[0.02]",
  ].join(" ");

  if (kind === "retweet" && tweet.retweetOf) {
    return (
      <article className={containerClass}>
        <p className="mb-2 text-xs text-muted">🔁 自分がリツイート</p>
        <ReferencedTweetBody tweet={tweet.retweetOf} />
        <CardFooter
          tweetId={tweet.id}
          publishedAt={tweet.publishedAt}
          extraLink={
            <Link
              href={`/tweets/${tweet.retweetOf.id}`}
              prefetch={false}
              className="text-xs hover:underline"
            >
              元ツイート →
            </Link>
          }
        />
      </article>
    );
  }

  if (kind === "quote" && tweet.retweetOf) {
    return (
      <article className={containerClass}>
        <BodyAndImages body={tweet.body} images={tweet.images} />
        <QuoteCard tweet={tweet.retweetOf} />
        <CardFooter tweetId={tweet.id} publishedAt={tweet.publishedAt} />
      </article>
    );
  }

  // 通常ツイート（または親 = self-reply の root）
  return (
    <article className={containerClass}>
      <BodyAndImages body={tweet.body} images={tweet.images} />
      <CardFooter tweetId={tweet.id} publishedAt={tweet.publishedAt} />
    </article>
  );
}

function BodyAndImages({
  body,
  images,
}: {
  body?: string;
  images?: TweetReference["images"];
}) {
  return (
    <>
      {body && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {body}
        </p>
      )}
      {images && images.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${
            images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {images.map((image) => (
            <div
              key={image.url}
              className="relative aspect-video overflow-hidden rounded-md border border-border"
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 320px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ReferencedTweetBody({ tweet }: { tweet: TweetReference }) {
  return (
    <div>
      <BodyAndImages body={tweet.body} images={tweet.images} />
      <p className="mt-2 text-xs text-muted">
        <time dateTime={tweet.publishedAt}>
          {formatTweetTimestamp(tweet.publishedAt)}
        </time>
      </p>
    </div>
  );
}

function QuoteCard({ tweet }: { tweet: TweetReference }) {
  return (
    <Link
      href={`/tweets/${tweet.id}`}
      prefetch={false}
      className="mt-3 block rounded-md border border-border p-3 hover:bg-foreground/[0.03]"
    >
      <BodyAndImages body={tweet.body} images={tweet.images} />
      <p className="mt-2 text-xs text-muted">
        <time dateTime={tweet.publishedAt}>
          {formatTweetTimestamp(tweet.publishedAt)}
        </time>
      </p>
    </Link>
  );
}

function CardFooter({
  tweetId,
  publishedAt,
  extraLink,
}: {
  tweetId: string;
  publishedAt: string;
  extraLink?: React.ReactNode;
}) {
  return (
    <footer className="mt-3 flex items-center justify-between text-sm text-muted">
      <Link
        href={`/tweets/${tweetId}`}
        prefetch={false}
        title={formatAbsoluteTimestamp(publishedAt)}
        className="hover:underline"
      >
        <time dateTime={publishedAt}>{formatTweetTimestamp(publishedAt)}</time>
      </Link>
      <div className="flex items-center gap-3 text-xs">
        {extraLink}
        <Link
          href={`/tweets/${tweetId}`}
          prefetch={false}
          className="hover:underline"
        >
          詳細 →
        </Link>
      </div>
    </footer>
  );
}
