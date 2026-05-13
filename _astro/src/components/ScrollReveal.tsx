import { useEffect } from "react";

// Astro Island。旧 app/(public)/scroll-reveal.tsx の移植。"use client"
// ディレクティブのみ削除、ロジックは framework agnostic で完全同一。
//
// [data-reveal] 要素を IntersectionObserver で監視し、初めて viewport
// に入ったタイミングで `.is-revealed` を付与 (CSS 側 portfolio.css の
// fade-in / mask reveal アニメ起点)。 reduced-motion 環境では即時に
// 全要素 reveal。
export function ScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (targets.length === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08,
      },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}

export default ScrollReveal;
