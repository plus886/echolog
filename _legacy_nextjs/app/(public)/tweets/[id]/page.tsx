import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatPortfolioTimestamp } from "@/lib/format";
import { getTweet, listThreadReplies } from "@/lib/microcms";
import { getRetweetKind, type Tweet } from "@/types/microcms";

import { ReferenceCard } from "../../reference-card";
import { TransitionLink } from "../../transition-link";
import { QuoteImages } from "./quote-images";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return { title: "Quote | echolog" };
}

export default async function TweetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let tweet: Tweet;
  try {
    tweet = await getTweet(id);
  } catch {
    notFound();
  }

  // リプライ取得は失敗しても本体表示は続ける (空配列にフォールバック)。
  const repliesRes = await listThreadReplies(id, { limit: 100 }).catch(
    () => null,
  );
  const replies = repliesRes?.contents ?? [];

  const retweetKind = getRetweetKind(tweet);
  const images = tweet.images ?? [];

  return (
    <article className="mx-auto mt-40 mb-24 w-full max-w-[844px] px-6 min-[880px]:px-10">
      {tweet.parent && tweet.parent.body && (
        <ReferenceCard
          label="In reply to"
          body={tweet.parent.body}
          href={`/tweets/${tweet.parent.id}`}
          className="mb-12"
        />
      )}

      {tweet.body && (
        <p className="m-0 whitespace-pre-wrap font-serif text-[24px] leading-[1.75] text-(--ink)">
          {tweet.body}
        </p>
      )}

      {tweet.retweetOf && tweet.retweetOf.body && (
        <ReferenceCard
          label={retweetKind === "quote" ? "Quoting" : "Retweeted"}
          body={tweet.retweetOf.body}
          href={`/tweets/${tweet.retweetOf.id}`}
          as="blockquote"
          className="mt-10"
        />
      )}

      <p className="mt-12 k-label-mini">
        {formatPortfolioTimestamp(tweet.publishedAt)}
      </p>

      {images.length > 0 && (
        <div className="mt-10">
          <QuoteImages images={images} />
        </div>
      )}

      {replies.length > 0 && (
        <section className="mt-24 text-right">
          <h2 className="mb-8 k-label-mini">
            ({replies.length}) Replies
          </h2>
          <ol className="m-0 flex list-none flex-col items-end gap-10 p-0">
            {replies.map((reply) => (
              <li key={reply.id} className="max-w-[75%] border-(--ink-15)">
                <TransitionLink
                  href={`/tweets/${reply.id}`}
                  className="block no-underline transition-opacity hover:opacity-60"
                >
                  {reply.body && (
                    <p className="m-0 whitespace-pre-wrap text-left font-serif text-[15px] leading-[1.8] text-(--ink)">
                      {reply.body}
                    </p>
                  )}
                  <p className="mt-3 k-label-mini">
                    {formatPortfolioTimestamp(reply.publishedAt)}
                  </p>
                </TransitionLink>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="mt-32 text-[12px] tracking-[0.04em] text-(--ink-50)">
        <TransitionLink href="/" className="border-b border-current pb-px">
          ← back to home
        </TransitionLink>
      </p>
    </article>
  );
}
