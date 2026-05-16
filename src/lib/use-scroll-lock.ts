import { useEffect } from "react";

// active が true の間、背景スクロールをロックする。Lenis が走っていれば
// lenis.stop() で止め (`.lenis-stopped` → portfolio.css の overflow: clip)、
// 未マウント (reduced-motion) 時は body.style.overflow を切り替える。Lenis と
// body.overflow を併用すると Lenis 内部の wheel handling と競合するので、必ず
// どちらか一方だけにする。
//
// 注: lightbox 固有のキー / wheel ハンドリングは各コンポーネントの別 effect に
// 残す。本フックは「背景スクロールのロック/解除」だけを担当する。
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const lenis = window.__lenis;
    let prevOverflow = "";
    if (lenis) {
      lenis.stop();
    } else {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (lenis) {
        lenis.start();
      } else {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [active]);
}
