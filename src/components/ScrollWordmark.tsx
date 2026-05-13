import { useEffect } from "react";

// Astro Island。旧 app/(public)/scroll-wordmark.tsx の移植 + hydration
// race の修正。
//
// 役割: hero の .k-wordmark が nav 線まで上ってきたタイミングで .k-shell
// に .is-scrolled を付与。CSS 側 (portfolio.css) で hero wordmark を hide
// + fixed pin (.k-wordmark-pin) を visible にする cascade を起動する。
//
// hydration timing 注意:
//   .k-wordmark は WordmarkLink Island に `className="k-wordmark ..."` で
//   付与されているが、WordmarkLink は `client:only="react"` で SSR には
//   出力されないため、ScrollWordmark がより先に hydrate されるとクエリ
//   が null を返して early return してしまう (= スクロールしても nav が
//   降りてこない)。
//   解決: 初回チェックで wordmark が見つからなければ MutationObserver で
//   appear を待ち、出現後に listener を attach する。
//
// data-navigating フラグは phase 5 の <ClientRouter /> 導入時には未だ
// astro:before-swap / astro:after-swap への移植をしていない。flag が
// 立っていなければ onScroll は素通り。
export function ScrollWordmark() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".k-shell");
    if (!shell) return;

    const navOffsetTop = 36; // matches PortfolioNav pt-9 = 36px
    let scrolled = false;
    let triggerY = 0;
    let listenerCleanup: (() => void) | null = null;
    let observerCleanup: (() => void) | null = null;

    const attach = (wordmark: HTMLElement) => {
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
      listenerCleanup = () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      };
    };

    const initial = document.querySelector<HTMLElement>(".k-wordmark");
    if (initial) {
      attach(initial);
    } else {
      // WordmarkLink Island の hydration 完了まで通常 1 frame 程度。
      // それまで MutationObserver で .k-wordmark の出現を待つ。
      const observer = new MutationObserver(() => {
        const wm = document.querySelector<HTMLElement>(".k-wordmark");
        if (wm) {
          observer.disconnect();
          observerCleanup = null;
          attach(wm);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      observerCleanup = () => observer.disconnect();
    }

    return () => {
      observerCleanup?.();
      listenerCleanup?.();
    };
  }, []);

  return null;
}

export default ScrollWordmark;
