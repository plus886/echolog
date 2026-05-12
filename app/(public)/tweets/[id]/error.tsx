"use client";

import { useEffect } from "react";

import { TransitionLink } from "../../transition-link";

export default function TweetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("/tweets/[id] render error", error);
  }, [error]);

  return (
    <article className="mx-auto mt-40 mb-24 w-full max-w-[844px] px-6 min-[880px]:px-10">
      <p className="m-0 font-serif text-[24px] leading-[1.75] text-(--ink)">
        ツイートを表示できませんでした。
      </p>
      <p className="mt-6 font-serif text-[15px] leading-[1.8] text-(--ink-70)">
        取得中にエラーが発生しました。少し時間を置いて再試行してみてください。
      </p>
      <div className="mt-12 flex gap-6 text-[12px] tracking-[0.04em] text-(--ink-50)">
        <button
          type="button"
          onClick={reset}
          className="border-b border-current pb-px"
        >
          retry
        </button>
        <TransitionLink href="/" className="border-b border-current pb-px">
          ← back to portfolio
        </TransitionLink>
      </div>
    </article>
  );
}
