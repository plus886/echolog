import { useEffect } from "react";

// Astro Island。旧 app/(public)/gallery-parallax.tsx の移植 (内容同一)。
//
// 各 .k-quote-wrap がローカルパララックスで「写真より遅くスクロール」する。
// 進捗 (0 → 1) を 0 → MAX_OFFSET の translateY に写像することで、
// photo より体感速度が遅くなる。
const MAX_OFFSET = 80;

export function GalleryParallax() {
  useEffect(() => {
    let rafId: number | null = null;

    const apply = () => {
      const vh = window.innerHeight;
      const wraps =
        document.querySelectorAll<HTMLElement>(".k-quote-wrap");
      wraps.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const eh = rect.height;
        const range = vh + eh;
        const progress =
          range > 0
            ? Math.max(0, Math.min(1, (vh - rect.top) / range))
            : 0;
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
