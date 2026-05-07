import Image from "next/image";
import Link from "next/link";

import { formatAbsoluteTimestamp, formatTweetTimestamp } from "@/lib/format";
import type { Tweet } from "@/types/microcms";

type Props = {
  tweet: Tweet;
};

export function TweetCard({ tweet }: Props) {
  const href = `/tweets/${tweet.id}`;

  return (
    <article className="border border-border rounded-lg p-4 hover:bg-foreground/[0.02] transition-colors">
      {tweet.body && (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
          {tweet.body}
        </p>
      )}

      {tweet.images && tweet.images.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${
            tweet.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {tweet.images.map((image) => (
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

      <footer className="mt-3 flex items-center justify-between text-sm text-muted">
        <Link
          href={href}
          prefetch={false}
          title={formatAbsoluteTimestamp(tweet.publishedAt)}
          className="hover:underline"
        >
          <time dateTime={tweet.publishedAt}>
            {formatTweetTimestamp(tweet.publishedAt)}
          </time>
        </Link>
        <Link
          href={href}
          prefetch={false}
          className="text-xs hover:underline"
        >
          詳細 →
        </Link>
      </footer>
    </article>
  );
}
