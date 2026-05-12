"use client";

import { useEffect, useState } from "react";

import type { OgpData } from "@/lib/og-parse";

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
    // state は無視する（loaded 後の再 fetch は url 変更時のみ）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!url || state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <div className="border-l border-(--ink-15) py-2 pl-4 text-[12px] italic text-(--ink-50)">
        loading OGP… <span className="opacity-60 not-italic">{url}</span>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="border-l border-(--ink-15) py-2 pl-4 text-[12px] italic text-(--ink-50)">
        プレビューを取得できませんでした ({state.message})
      </div>
    );
  }
  const { data } = state;
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 border-l border-(--ink-30) py-2 pl-4 no-underline transition-opacity hover:opacity-70"
    >
      {data.image && (
        // microCMS と無関係の外部画像なので next/image は使わず生 img を使う。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt=""
          className="h-20 w-32 shrink-0 bg-(--paper-2) object-cover"
        />
      )}
      <div className="flex min-w-0 flex-col gap-1">
        {data.siteName && (
          <p className="m-0 k-label-mini">
            {data.siteName}
          </p>
        )}
        {data.title && (
          <p className="m-0 line-clamp-2 font-serif text-[15px] leading-[1.6] text-(--ink)">
            {data.title}
          </p>
        )}
        {data.description && (
          <p className="m-0 line-clamp-2 font-serif text-[13px] leading-[1.7] text-(--ink-70)">
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}
