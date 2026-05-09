"use client";

import Link from "next/link";
import { useEffect } from "react";

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
    <main className="mx-auto max-w-2xl w-full px-4 py-12 flex flex-col gap-3">
      <h1 className="text-lg font-semibold">ツイートを表示できませんでした</h1>
      <p className="text-sm text-muted">
        取得中にエラーが発生しました。
      </p>
      <div className="flex gap-3 text-sm">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-4 py-1.5 hover:bg-foreground/[0.04]"
        >
          再試行
        </button>
        <Link
          href="/feed"
          prefetch={false}
          className="rounded-md px-4 py-1.5 text-muted hover:underline"
        >
          フィードに戻る
        </Link>
      </div>
    </main>
  );
}
