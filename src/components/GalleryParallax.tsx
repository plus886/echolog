import { useEffect } from "react";

// Astro Island。旧 app/(public)/gallery-parallax.tsx の移植 + 拡張。
//
// 「parallax を発動するか」は呼び出し側 (markup) が `data-parallax` 属性で
// opt in する。本コンポーネントは属性付き要素を全 query して、各々に
// scroll 進捗 (0 → 1) × MAX_OFFSET を `--k-parallax-y` として渡す。実際の
// translateY は CSS 側 (portfolio.css) で var を消費して描画する。parallax
// は一律 `transform: translateY(--k-parallax-y px)` に集約 (中央寄せは
// .k-quote-wrap の translate / photo の Tailwind translate と別プロパティ):
//   - .k-quote-wrap → 中央寄せ済みの quote ラッパー (transform で parallax)
//   - .k-parallax   → 汎用 (Intro テキスト / gallery photo に重ねる)
// 属性なしの要素は --k-parallax-y が unset → translateY(0) で静止する。
// reduced-motion は CSS 側で transform を抑制。
const MAX_OFFSET = 80;
const PARALLAX_SELECTOR = "[data-parallax]";

export function GalleryParallax() {
  useEffect(() => {
    let rafId: number | null = null;

    const apply = () => {
      const vh = window.innerHeight;
      const wraps = document.querySelectorAll<HTMLElement>(PARALLAX_SELECTOR);
      wraps.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const eh = rect.height;
        const range = vh + eh;
        const progress =
          range > 0 ? Math.max(0, Math.min(1, (vh - rect.top) / range)) : 0;
        const offset = progress * MAX_OFFSET;
        el.style.setProperty("--k-parallax-y", offset.toFixed(2));
      });
      rafId = null;
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}

export default GalleryParallax;
