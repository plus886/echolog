import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getTweet, listThreadReplies } from "@/lib/microcms";
import { getRetweetKind, type Tweet } from "@/types/microcms";

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
        <TransitionLink
          href={`/tweets/${tweet.parent.id}`}
          className="mb-12 block no-underline"
        >
          <div className="border-l border-(--ink-30) pl-6 transition-colors hover:border-(--ink-50)">
            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
              In reply to
            </p>
            <p className="m-0 font-serif text-[15px] leading-[1.8] text-(--ink-70)">
              {tweet.parent.body}
            </p>
          </div>
        </TransitionLink>
      )}

      {tweet.body && (
        <p className="m-0 whitespace-pre-wrap font-serif text-[24px] leading-[1.75] text-(--ink)">
          {tweet.body}
        </p>
      )}

      {tweet.retweetOf && tweet.retweetOf.body && (
        <TransitionLink
          href={`/tweets/${tweet.retweetOf.id}`}
          className="mt-10 block no-underline"
        >
          <blockquote className="m-0 border-l border-(--ink-30) pl-6 transition-colors hover:border-(--ink-50)">
            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
              {retweetKind === "quote" ? "Quoting" : "Retweeted"}
            </p>
            <p className="m-0 whitespace-pre-wrap font-serif text-[15px] leading-[1.8] text-(--ink-70)">
              {tweet.retweetOf.body}
            </p>
          </blockquote>
        </TransitionLink>
      )}

      <p className="mt-12 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
        {formatPublishedAt(tweet.publishedAt)}
      </p>

      {images.length > 0 && (
        <div className="mt-10">
          <QuoteImages images={images} />
        </div>
      )}

      {replies.length > 0 && (
        <section className="mt-24 text-right">
          <h2 className="mb-8 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
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
                  <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
                    {formatPublishedAt(reply.publishedAt)}
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

function formatPublishedAt(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}
