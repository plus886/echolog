import { useEffect, useState } from "react";

import type { OgpData } from "@/lib/og-parse";

// 本文中の URL の OGP プレビューを /api/og-preview から取得して表示する。

const DEBOUNCE_MS = 600;

type State =
  | { status: "idle" }
  | { status: "loading"; url: string }
  | { status: "loaded"; url: string; data: OgpData }
  | { status: "error"; url: string; message: string };

type Props = {
  url: string | null;
};

export function LinkPreview({ url }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }
    if (state.status !== "idle" && state.url === url) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ status: "loading", url });
      try {
        const res = await fetch(
          `/api/og-preview?url=${encodeURIComponent(url)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setState({
            status: "error",
            url,
            message: `OGP 取得失敗 (${res.status})`,
          });
          return;
        }
        const data = (await res.json()) as OgpData;
        setState({ status: "loaded", url, data });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState({
          status: "error",
          url,
          message: e instanceof Error ? e.message : "OGP 取得失敗",
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!url || state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <div className="rounded-md border border-(--ink-15) px-3 py-2 text-[13px] text-(--ink-50)">
        リンクプレビューを取得中…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-md border border-(--ink-15) px-3 py-2 text-[13px] text-(--ink-50)">
        プレビューを取得できませんでした（{state.message}）
      </div>
    );
  }
  const { data } = state;
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 overflow-hidden rounded-md border border-(--ink-15) no-underline transition-colors hover:bg-(--paper-2)"
    >
      {data.image && (
        <img
          src={data.image}
          alt=""
          className="h-20 w-28 shrink-0 bg-(--paper-2) object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col justify-center gap-0.5 py-2 pr-3">
        {data.siteName && (
          <p className="m-0 text-[11px] tracking-wide text-(--ink-50) uppercase">
            {data.siteName}
          </p>
        )}
        {data.title && (
          <p className="m-0 line-clamp-2 text-sm leading-snug font-medium text-(--ink)">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="m-0 line-clamp-2 text-[13px] leading-snug text-(--ink-70)">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
