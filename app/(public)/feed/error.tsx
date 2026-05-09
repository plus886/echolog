"use client";

import { useEffect } from "react";

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("/feed render error", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-12 flex flex-col gap-3">
      <h1 className="text-lg font-semibold">フィードを表示できませんでした</h1>
      <p className="text-sm text-muted">
        ツイートの取得中にエラーが発生しました。少し時間をおいて再度お試しください。
      </p>
      <button
        type="button"
        onClick={reset}
        className="self-start rounded-md border border-border px-4 py-1.5 text-sm hover:bg-foreground/[0.04]"
      >
        再試行
      </button>
    </main>
  );
}
