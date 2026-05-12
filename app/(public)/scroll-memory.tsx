"use client";

import { useEffect } from "react";

import { useIsoLayoutEffect } from "@/lib/use-iso-layout-effect";

const KEY = "k-home-scroll-y";

// Home (/) の scrollY を sessionStorage に常時保存し、mount 時 (= 戻ってきた時)
// に復元する。詳細ページから browser back / "← back to portfolio" クリックで
// 戻ったときに、ホームのスクロール位置が元の所に戻る。reload 時は復元しない
// (ユーザの「明示的にリセット」意図を尊重する)。
//
// 復元処理は useLayoutEffect で paint 前に同期実行する。これにより
// (a) View Transitions API の "after" snapshot が復元後の状態を捉える
//     (= crossfade 終了時に nav 位置がブレない)
// (b) 初回 paint で既に nav が下りた状態になる
//     (= "戻った瞬間 nav が降りてくる" アニメーションが起きない)。
//
// ScrollWordmark の listener は useEffect で後から attach されるため、
// その前段階でこちらが .is-scrolled を直接付与し、後で listener が同状態
// を確認する形にする。.no-shell-transitions は 300ms 維持して、その間の
// listener 反応・redundancy も transition なしで処理されるよう保護する。
export function ScrollMemory() {
  useIsoLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    if (!shell) return;

    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const isReload = nav?.type === "reload";
    if (isReload) return;

    const saved = sessionStorage.getItem(KEY);
    if (!saved) return;
    const y = parseInt(saved, 10);
    if (!Number.isFinite(y) || y <= 0) return;

    shell.classList.add("no-shell-transitions");
    // 半分以上スクロールしていたなら、戻り時の nav 表示状態を先取りする。
    // ScrollWordmark の listener が後で同じ判定を行うが、その間の
    // class toggle は no-shell-transitions が効いているので動かない。
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
