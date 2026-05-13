import { useEffect } from "react";

// Astro Island。旧 app/(public)/scroll-wordmark.tsx の移植。
// data-navigating フラグは旧 TransitionLink がクライアント遷移中に
// <html> 上に立てていた。Astro 移植では phase 5 で <ClientRouter />
// を入れたとき同等のフラグを再導入する想定 (フラグが存在しないうちは
// 単に false で常に通る)。
//
// 役割: hero の .k-wordmark が nav 線まで上ってきたタイミングで .k-shell
// に .is-scrolled を付与。CSS 側 (portfolio.css) で hero wordmark を hide
// + fixed pin (.k-wordmark-pin) を visible にする cascade を起動する。
export function ScrollWordmark() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    const wordmark = document.querySelector<HTMLElement>(".k-wordmark");
    if (!shell || !wordmark) return;

    const navOffsetTop = 36; // matches PortfolioNav pt-9 = 36px
    let scrolled = false;
    let triggerY = 0;

    const measure = () => {
      const rect = wordmark.getBoundingClientRect();
      triggerY = rect.top + window.scrollY - navOffsetTop;
    };

    const apply = (v: boolean) => {
      if (v === scrolled) return;
      scrolled = v;
      shell.classList.toggle("is-scrolled", scrolled);
    };

    const onScroll = () => {
      if (document.documentElement.dataset.navigating) return;
      apply(window.scrollY >= triggerY);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
