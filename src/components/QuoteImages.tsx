import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

// Astro Island。旧 app/(public)/tweets/[id]/quote-images.tsx (Next.js
// "use client" component) からの移植 → tweet 詳細用 jitter scatter に拡張。
//
// 旧実装: 96x96 thumbnail を flex-wrap で並べるだけ。
// 現実装: Home gallery と同じ `.k-pos` + 決定論的 jitter 配置。slot 計算は
//   呼び出し側 (tweets/[id].astro) で `generateQuoteImagesLayout(images,
//   hashStringToSeed(tweet.id))` として実行し、結果を props で受け取る。
//   QuoteImages 自体は client:only なので、計算結果は SSR フェーズで決まり
//   client mount 後に同じ slot が再現される。
//
// View Transitions API でサムネ ↔ overlay を直接 morph させるロジックは
// 旧実装と同じ。サムネのサイズ/位置が違うだけで qimg-N の対応関係は不変。

type ImageEntry = {
  url: string;
  width?: number;
  height?: number;
};

type Slot = {
  leftPct: number;
  top: number;
  w: number;
  h: number;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished?: Promise<void>;
  };
};

export function QuoteImages({
  images,
  slots,
  totalHeight,
}: {
  images: ImageEntry[];
  slots: Slot[];
  totalHeight: number;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [morphIdx, setMorphIdx] = useState<number | null>(null);
  const isAnimatingRef = useRef(false);

  const supportsVT = (): boolean =>
    typeof (document as ViewTransitionDocument).startViewTransition ===
    "function";

  const open = useCallback((i: number) => {
    if (isAnimatingRef.current) return;
    if (!supportsVT()) {
      setOpenIdx(i);
      return;
    }
    isAnimatingRef.current = true;
    flushSync(() => setMorphIdx(i));
    const doc = document as ViewTransitionDocument;
    const t = doc.startViewTransition!(() => {
      flushSync(() => setOpenIdx(i));
    });
    const cleanup = () => {
      setMorphIdx(null);
      isAnimatingRef.current = false;
    };
    t.finished?.then(cleanup).catch(cleanup);
  }, []);

  const close = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (!supportsVT()) {
      setOpenIdx(null);
      setMorphIdx(null);
      return;
    }
    isAnimatingRef.current = true;
    const target = openIdx;
    if (target === null) {
      isAnimatingRef.current = false;
      return;
    }
    flushSync(() => setMorphIdx(target));
    const doc = document as ViewTransitionDocument;
    const t = doc.startViewTransition!(() => {
      flushSync(() => setOpenIdx(null));
    });
    const cleanup = () => {
      setMorphIdx(null);
      isAnimatingRef.current = false;
    };
    t.finished?.then(cleanup).catch(cleanup);
  }, [openIdx]);

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
      <div className="relative w-full" style={{ height: `${totalHeight}px` }}>
        {images.map((img, i) => {
          const slot = slots[i];
          if (!slot) return null;
          const hasName = morphIdx === i && openIdx !== i;
          // `.k-pos` (portfolio.css) は --side-margin / --w / --ideal-left を
          // 読んで CSS clamp() で left を解決する。Home gallery では
          // --side-margin: 60px だが、tweet 詳細では article 側 (px-6/px-10)
          // で既に padding が効いているので 0px に上書きする。
          const thumbStyle: CSSProperties = {
            ["--side-margin" as string]: "0px",
            ["--w" as string]: `${slot.w}px`,
            ["--ideal-left" as string]: String(slot.leftPct),
            top: `${slot.top}px`,
            width: `${slot.w}px`,
            height: `${slot.h}px`,
          };
          // microCMS 画像 API。w のみ指定して aspect は維持。retina 向けに 2x。
          const renderWidth = Math.max(Math.ceil(slot.w * 2), 400);
          return (
            <button
              key={i}
              type="button"
              onClick={() => open(i)}
              className="k-pos absolute m-0 block -translate-x-1/2 cursor-zoom-in overflow-hidden border-0 bg-(--paper-2) p-0"
              style={thumbStyle}
              aria-label={`Open image ${i + 1}`}
            >
              <img
                src={`${img.url}?w=${renderWidth}`}
                alt=""
                loading="lazy"
                className="block h-full w-full object-cover"
                style={
                  hasName
                    ? ({
                        viewTransitionName: `qimg-${i}`,
                      } as CSSProperties)
                    : undefined
                }
              />
            </button>
          );
        })}
      </div>

      {openIdx !== null && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-(--paper)/95 p-8"
          onClick={close}
          role="presentation"
        >
          <img
            src={`${images[openIdx].url}?w=1600`}
            alt=""
            className="max-h-[90vh] max-w-[90vw] cursor-default object-contain"
            onClick={(e) => e.stopPropagation()}
            style={
              {
                viewTransitionName: `qimg-${openIdx}`,
              } as CSSProperties
            }
          />
        </div>
      )}
    </>
  );
}

export default QuoteImages;
