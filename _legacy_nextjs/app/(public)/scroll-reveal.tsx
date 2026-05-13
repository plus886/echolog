"use client";

import { useEffect } from "react";

// Wires up scroll-triggered fade-in for any element marked with
// [data-reveal]. Sets opacity 0 → 1 once an element first crosses into
// the viewport and then stops watching it. Honours reduced-motion.
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
        // Fire when ~10% of the element has entered, with a small bottom
        // bias so things resolve just before they hit the fold center.
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08,
      },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
