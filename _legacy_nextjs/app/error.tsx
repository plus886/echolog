"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-12 flex flex-col gap-3">
      <h1 className="text-lg font-semibold">エラーが発生しました</h1>
      <p className="text-sm text-muted">
        ページを表示できません。再試行するか、しばらくしてからアクセスしてください。
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted">digest: {error.digest}</p>
      )}
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
