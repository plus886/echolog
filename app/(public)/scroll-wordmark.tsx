"use client";

import { useEffect } from "react";

// Toggles `.is-scrolled` on .k-shell once the hero's KO KAIJI wordmark
// has scrolled to the nav line. CSS handles the rest — hiding the hero
// wordmark (while keeping it in flow so the h1 doesn't reflow) and
// revealing the fixed `.k-wordmark-pin` clone at the same position.
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

    const onScroll = () => apply(window.scrollY >= triggerY);
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
