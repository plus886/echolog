import { useEffect } from "react";

// Astro Island。旧 app/(public)/gallery-parallax.tsx の移植 + 拡張。
//
// 元はギャラリー内の .k-quote-wrap だけが対象だったが、Intro テキストにも
// 同じ「写真より遅くスクロール」を適用したくなったので、generic な
// `.k-parallax` クラスも query 対象に加えた。各要素の進捗 (viewport 中央
// との相対位置 0 → 1) を 0 → MAX_OFFSET の translateY に写像する。
// CSS 側 (portfolio.css):
//   - .k-quote-wrap → translateX(-50%) translateY(--k-parallax-y px)
//   - .k-parallax   → translateY(--k-parallax-y px) のみ
// どちらも reduced-motion では transform 無効化。
const MAX_OFFSET = 80;
const PARALLAX_SELECTOR = ".k-quote-wrap, .k-parallax";

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
