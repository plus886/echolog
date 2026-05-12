"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type ImageEntry = {
  url: string;
  // microCMS の MicroCMSImage は width/height が optional。現状 JSX 内では
  // 使っていないが、将来 srcset などで活かす余地のために型だけ受けておく。
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
// ロック。microCMS image URL の ?w=... クエリでサムネ用と拡大用の解像度を
// 切り替えてバンド幅を節約する。
//
// View Transitions API でサムネ ↔ overlay を直接 morph させる:
// - 開く前にクリックされた thumbnail に `view-transition-name: qimg-N` を
//   付与し (flushSync で同期)、その状態を OLD snapshot に焼き付ける。
// - startViewTransition の callback で setOpenIdx(i)。NEW snapshot 時には
//   thumbnail から name が外れ (openIdx === i のため)、overlay 側に同じ
//   name が付くので、ブラウザがサイズ/位置を補間して滑らかに拡大する。
// - 閉じる時は逆向きに同じ手順。
// - 未対応ブラウザでは即時 open/close (graceful degradation)。
// - 普段 (lightbox 開閉中以外) は thumbnail に name が付いていないので、
//   ページ遷移時の transition と干渉しない。
export function QuoteImages({ images }: { images: ImageEntry[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  // 「いま morph に参加している」index。OLD snapshot の前に flushSync で
  // 立て、t.finished 後にクリア。普段は null。
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
    // 1) thumbnail i に view-transition-name を割り当てた状態を DOM に焼く
    flushSync(() => setMorphIdx(i));
    // 2) view transition 開始。callback 内で openIdx を更新すると、
    //    name は thumbnail から外れ overlay に移る。
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
    // 現状: openIdx === i, morphIdx === null。
    // OLD snapshot: overlay に name 'qimg-i'、thumbnail には無し。
    // morphIdx を i にしておくと、callback で openIdx を null にしたあと
    // 「morphIdx === i && openIdx !== i」が真になり thumbnail に name 復帰。
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
