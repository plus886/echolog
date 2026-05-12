"use client";

import { useCallback, useEffect, useState } from "react";

type ImageEntry = {
  url: string;
  width: number;
  height: number;
};

// 96x96 のサムネイル grid + lightbox。サムネクリックで full-screen overlay
// を開き、背景クリック / ESC で閉じる。開いている間は body のスクロールを
// ロック。microCMS image URL の ?w=... クエリでサムネ用と拡大用の解像度を
// 切り替えてバンド幅を節約する。
export function QuoteImages({ images }: { images: ImageEntry[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const close = useCallback(() => setOpenIdx(null), []);

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openIdx, close]);

  if (images.length === 0) return null;

  return (
    <>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {images.map((img, i) => (
          <li key={i} className="m-0 p-0">
            <button
              type="button"
              onClick={() => setOpenIdx(i)}
              className="block h-24 w-24 cursor-zoom-in overflow-hidden border-0 bg-(--paper-2) p-0"
              aria-label={`Open image ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${img.url}?w=192&h=192&fit=crop`}
                alt=""
                loading="lazy"
                className="block h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {openIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-(--paper)/95 p-8"
          onClick={close}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${images[openIdx].url}?w=1600`}
            alt=""
            className="max-h-[90vh] max-w-[90vw] cursor-default object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
