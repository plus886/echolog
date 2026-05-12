import type { Metadata } from "next";

import { TransitionLink } from "../../transition-link";
import { QuoteImages } from "./quote-images";

export const revalidate = 3600;

type MockReply = { id: string; body: string; publishedAt: string };
type MockReference = { body: string; publishedAt: string };
type MockQuote = {
  id: string;
  body: string;
  publishedAt: string;
  images: { url: string; width: number; height: number }[];
  parent?: MockReference;
  retweetOf?: MockReference;
  retweetKind?: "retweet" | "quote";
  replies: MockReply[];
};

// mock — 実 microCMS 連動前のレイアウト確認用。id パラメータは無視し、
// どの id でもこの同じデータを返す。
const MOCK_QUOTE: MockQuote = {
  id: "mock-1",
  body: "コードを書くという行為と、文章を書くという行為のあいだに、どれくらいの距離があるのかを、ここ数年ずっと考えている。",
  publishedAt: "2026-04-15T10:32:00.000Z",
  images: [
    {
      url: "https://picsum.photos/seed/q-d1/900/600",
      width: 900,
      height: 600,
    },
    {
      url: "https://picsum.photos/seed/q-d2/900/700",
      width: 900,
      height: 700,
    },
  ],
  parent: {
    body: "昨日の続き。日本語と中国語のあいだの「翻訳されない隙間」について。",
    publishedAt: "2026-04-14T22:01:00.000Z",
  },
  retweetOf: {
    body: "言葉は道具ではなく、考えの輪郭そのものだ。",
    publishedAt: "2026-04-15T09:55:00.000Z",
  },
  retweetKind: "quote",
  replies: [
    {
      id: "r-1",
      body: "近いはずなのに、毎日距離が変わって見える。",
      publishedAt: "2026-04-15T11:05:00.000Z",
    },
    {
      id: "r-2",
      body: "文章は迷子になれるが、コードは迷子になれない、というのは思っていた。",
      publishedAt: "2026-04-15T11:42:00.000Z",
    },
    {
      id: "r-3",
      body: "迷子になれるか否か、というのは良い軸かもしれない。",
      publishedAt: "2026-04-15T12:10:00.000Z",
    },
  ],
};

export function generateMetadata(): Metadata {
  return { title: "Quote | echolog" };
}

export default async function TweetPage() {
  const quote = MOCK_QUOTE;

  return (
    <article className="mx-auto mt-40 mb-24 w-full max-w-[844px] px-6 min-[880px]:px-10">
        {quote.parent && (
          <div className="mb-12 border-l border-(--ink-30) pl-6">
            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
              In reply to
            </p>
            <p className="m-0 font-serif text-[15px] leading-[1.8] text-(--ink-70)">
              {quote.parent.body}
            </p>
          </div>
        )}

        <p className="m-0 font-serif text-[24px] leading-[1.75] text-(--ink)">
          {quote.body}
        </p>

        {quote.retweetOf && (
          <blockquote className="m-0 mt-10 border-l border-(--ink-30) pl-6">
            <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
              {quote.retweetKind === "quote" ? "Quoting" : "Retweeted"}
            </p>
            <p className="m-0 font-serif text-[15px] leading-[1.8] text-(--ink-70)">
              {quote.retweetOf.body}
            </p>
          </blockquote>
        )}

        <p className="mt-12 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
          {formatPublishedAt(quote.publishedAt)}
        </p>

        {quote.images.length > 0 && (
          <div className="mt-10">
            <QuoteImages images={quote.images} />
          </div>
        )}

        {quote.replies.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-8 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
              ({quote.replies.length}) Replies
            </h2>
            <ol className="m-0 flex list-none flex-col gap-10 p-0">
              {quote.replies.map((reply) => (
                <li key={reply.id} className="border-l border-(--ink-15) pl-6">
                  <p className="m-0 font-serif text-[15px] leading-[1.8] text-(--ink)">
                    {reply.body}
                  </p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-(--ink-50)">
                    {formatPublishedAt(reply.publishedAt)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

      <p className="mt-32 text-[12px] tracking-[0.04em] text-(--ink-50)">
        <TransitionLink href="/" className="border-b border-current pb-px">
          ← back to portfolio
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
