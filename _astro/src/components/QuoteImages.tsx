import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

// Astro Island。旧 app/(public)/tweets/[id]/quote-images.tsx (Next.js
// "use client" component) からの移植。実装は完全に同一で、変更点は:
//   - "use client" ディレクティブを削除 (Astro では `client:load` 等を
//     呼び出し側 .astro 上で指定する)
//   - Next.js 固有の eslint-disable コメントを削除

type ImageEntry = {
  url: string;
  width?: number;
  height?: number;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished?: Promise<void>;
  };
};

// 96x96 のサムネイル grid + lightbox。サムネクリックで full-screen overlay
// を開き、背景クリック / ESC で閉じる。開いている間は body のスクロールを
// ロック。
//
// View Transitions API でサムネ ↔ overlay を直接 morph させる:
// - 開く前にクリックされた thumbnail に `view-transition-name: qimg-N` を
//   付与し (flushSync で同期)、その状態を OLD snapshot に焼き付ける。
// - startViewTransition の callback で setOpenIdx(i)。NEW snapshot 時には
//   thumbnail から name が外れ、overlay 側に同じ name が付くので、
//   ブラウザがサイズ/位置を補間して滑らかに拡大する。
// - 閉じる時は逆向きに同じ手順。未対応ブラウザでは即時 open/close。
export function QuoteImages({ images }: { images: ImageEntry[] }) {
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
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {images.map((img, i) => {
          const hasName = morphIdx === i && openIdx !== i;
          return (
            <li key={i} className="m-0 p-0">
              <button
                type="button"
                onClick={() => open(i)}
                className="block h-24 w-24 cursor-zoom-in overflow-hidden border-0 bg-(--paper-2) p-0"
                aria-label={`Open image ${i + 1}`}
              >
                <img
                  src={`${img.url}?w=192&h=192&fit=crop`}
                  alt=""
                  loading="lazy"
                  className="block h-full w-full object-cover"
                  style={
                    hasName
                      ? ({
                          viewTransitionName: `qimg-${i}`,
                        } as React.CSSProperties)
                      : undefined
                  }
                />
              </button>
            </li>
          );
        })}
      </ul>

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
              } as React.CSSProperties
            }
          />
        </div>
      )}
    </>
  );
}

export default QuoteImages;
