import { useEffect } from "react";

import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";

const KEY = "k-home-scroll-y";

// Astro Island。旧 app/(public)/scroll-memory.tsx の移植 (内容同一)。
//
// Home (/) の scrollY を sessionStorage に常時保存し、mount 時 (= 戻ってきた時)
// に復元する。詳細ページから browser back / "← back to home" クリックで
// 戻ったとき、ホームのスクロール位置が元の所に戻る。reload 時は復元しない。
//
// 復元処理は useLayoutEffect で paint 前に同期実行。Astro でも同じ理由で
// 必要 ((a) phase 5 で View Transitions API を有効化したときに "after"
// snapshot が復元後の状態を捉える、(b) 初回 paint で nav が下りた状態
// になる)。
export function ScrollMemory() {
  useIsoLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    if (!shell) return;

    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const isReload = nav?.type === "reload";
    if (isReload) return;

    const saved = sessionStorage.getItem(KEY);
    if (!saved) return;
    const y = parseInt(saved, 10);
    if (!Number.isFinite(y) || y <= 0) return;

    shell.classList.add("no-shell-transitions");
    if (y > window.innerHeight * 0.5) {
      shell.classList.add("is-scrolled");
    }
    window.scrollTo(0, y);
    setTimeout(() => {
      shell.classList.remove("no-shell-transitions");
    }, 300);
  }, []);

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        sessionStorage.setItem(KEY, String(window.scrollY));
        rafId = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}

export default ScrollMemory;
