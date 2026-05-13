import Lenis from "lenis";
import { useEffect } from "react";

// Astro Island。Public.astro layout で `client:only="react"` として 1 度だけ
// mount され、ページ全体に Lenis の慣性スクロールを適用する。
//
// 設計メモ:
//  - Lenis インスタンスは `window.__lenis` に晒す。WordmarkLink (scrollTo)
//    / QuoteImages (lightbox 中の scroll lock) / ScrollMemory (位置復元) が
//    Lenis API 経由で操作するため。読み取りだけの ScrollWordmark /
//    GalleryParallax は Lenis が native scroll event を dispatch するので
//    `window.addEventListener("scroll", ...)` のままで足りる。
//  - `prefers-reduced-motion: reduce` の環境では Lenis を init しない。
//    その場合 `window.__lenis` は未定義のままで、各 caller はネイティブ
//    fallback (`window.scrollTo`, `body.style.overflow`) を使う。
//  - RAF loop は SmoothScroll が握る。`destroy()` 時にループも止める。
//  - HMR で再 mount された場合に二重起動しないよう、既存 instance を
//    destroy してから新規作成する。
export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // HMR 等で残った旧 instance を掃除
    window.__lenis?.destroy();

    const lenis = new Lenis({
      // デフォルトの easeOutExpo 系で十分滑らか。tuning が要れば後で。
      // autoRaf: false (= 自前 RAF) にしてループ管理を unmount に揃える。
      autoRaf: false,
    });
    window.__lenis = lenis;

    let rafId = 0;
    const tick = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      if (window.__lenis === lenis) {
        window.__lenis = undefined;
      }
    };
  }, []);

  return null;
}

export default SmoothScroll;
