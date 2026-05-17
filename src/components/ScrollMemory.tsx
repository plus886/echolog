import { useEffect } from "react";

import { HOME_SCROLL_KEY } from "@/lib/constants";
import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";

// Astro Island。旧 app/(public)/scroll-memory.tsx の移植 (内容同一)。
//
// Home (/) の scrollY を sessionStorage に常時保存し、mount 時 (= 戻ってきた時)
// に復元する。詳細ページから browser back / "← back to home" クリックで
// 戻ったとき、ホームのスクロール位置が元の所に戻る。reload 時は復元しない。
//
// 例外: URL に hash がある場合 (詳細ページの nav リンク / 直打ち) は、
// 保存位置の復元ではなく該当アンカーへスクロールする。
//
// 復元処理は useLayoutEffect で paint 前に同期実行。Astro でも同じ理由で
// 必要 ((a) phase 5 で View Transitions API を有効化したときに "after"
// snapshot が復元後の状態を捉える、(b) 初回 paint で nav が下りた状態
// になる)。
export function ScrollMemory() {
  useIsoLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    if (!shell) return;

    // hash 付きの来訪 (詳細ページの nav リンククリック / URL 直打ち) は、
    // 保存済みスクロール位置の復元より アンカー位置を優先する。
    const hashTarget =
      window.location.hash.length > 1
        ? document.getElementById(window.location.hash.slice(1))
        : null;
    if (hashTarget) {
      const anchorTop = () =>
        hashTarget.getBoundingClientRect().top + window.scrollY;

      // 動きを抑える設定では即座にアンカーへ。
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.scrollTo(0, anchorTop());
        return;
      }

      // ネイティブの hash ジャンプを打ち消してトップから始める。初回
      // paint はトップになり、そこから home の in-page アンカーと同じ
      // Lenis の慣性スクロールでアンカーまで降りる。nav の状態遷移も
      // スクロールに連動して自然に走る。
      window.scrollTo(0, 0);

      let cancelled = false;
      let frames = 0;
      const startSmoothScroll = () => {
        if (cancelled) return;
        const lenis = window.__lenis;
        if (lenis) {
          lenis.scrollTo(anchorTop(), {});
        } else if (frames < 120) {
          // Lenis は別 island (SmoothScroll) で起動するため待つ。
          frames += 1;
          requestAnimationFrame(startSmoothScroll);
        } else {
          window.scrollTo(0, anchorTop());
        }
      };
      // フォント確定 (テキスト高さの最終化) を待ってからアンカー位置を
      // 確定させ、スクロール先のズレを防ぐ。
      void document.fonts.ready.then(() => {
        requestAnimationFrame(startSmoothScroll);
      });

      return () => {
        cancelled = true;
      };
    }

    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const isReload = nav?.type === "reload";
    if (isReload) return;

    const saved = sessionStorage.getItem(HOME_SCROLL_KEY);
    if (!saved) return;
    const y = parseInt(saved, 10);
    if (!Number.isFinite(y) || y <= 0) return;

    shell.classList.add("no-shell-transitions");
    if (y > window.innerHeight * 0.5) {
      shell.classList.add("is-scrolled");
    }
    // ここは layout effect なので必ず Lenis 起動より前に走る。ネイティブ
    // window.scrollTo で位置を変えると、後で起動する Lenis がコンストラクタ
    // 内で window.pageYOffset を初期値として取り込むので Lenis 側の内部状態
    // も復元後の位置になり、再起時に "0 からの慣性復元" 等が起きない。
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
        sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY));
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
