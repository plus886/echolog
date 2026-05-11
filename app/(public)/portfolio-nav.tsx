"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Each visible character is wrapped in its own .k-nav-char span so the
// ripple handler can drive their opacity individually.
function NavLabel({ children }: { children: string }) {
  return (
    <span className="k-nav-text">
      {[...children].map((ch, i) => (
        <span key={i} className="k-nav-char">
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

// Per-link ripple: from the entry point (mouseenter clientX or the
// focused link's left edge) compute each character's distance and use
// it as an animation-delay so the opacity dip spreads outward from the
// touched character to the ends of the label.
function dispatchRipple(link: HTMLElement, originX: number) {
  const chars = link.querySelectorAll<HTMLElement>(".k-nav-char");
  chars.forEach((c) => {
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const d = Math.abs(cx - originX);
    c.style.setProperty("--ripple-delay", `${d * 5}ms`);
    c.classList.remove("is-rippling");
    // Force reflow so the animation restarts from frame 0.
    void c.offsetWidth;
    c.classList.add("is-rippling");
  });
}

const onEnter = (e: React.MouseEvent<HTMLElement>) => {
  dispatchRipple(e.currentTarget, e.clientX);
};
const onFocus = (e: React.FocusEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  dispatchRipple(e.currentTarget, r.left);
};

// Top nav skeleton:
//  - 5 slots distributed across a 24-column grid (brand · portfolio ·
//    information w/ dropdown · about · contact, last item right-aligned)
//  - mix-blend-difference so chrome stays legible against any background
//  - Below 880px the row collapses to a (menu) / (close) toggle that
//    opens a full-bleed overlay
//  - Hovering a label triggers a per-character opacity ripple that
//    emanates from the cursor's entry point through that label only.
export function PortfolioNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 880px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <header className="k-nav pointer-events-none fixed inset-x-0 top-0 z-20 mix-blend-difference px-col-1 pt-9 text-(--grey-light)">
      {/* 5 slots distributed with space-between: outer two pin to the
          header's content edges, the rest take equal gaps between
          them. The middle slot is an invisible spacer so the hero's
          KO KAIJI wordmark (pinned by ScrollWordmark) lands at the
          visual center alongside the other four labels. */}
      <ul className="k-nav-row pointer-events-auto hidden items-baseline justify-between text-[12px] font-normal uppercase tracking-[0.1em] min-[880px]:flex">
        <li>
          <Link
            href="#about"
            className="k-nav-link"
            onMouseEnter={onEnter}
            onFocus={onFocus}
          >
            <NavLabel>About</NavLabel>
          </Link>
        </li>
        <li>
          <Link
            href="#"
            className="k-nav-link"
            onMouseEnter={onEnter}
            onFocus={onFocus}
          >
            <NavLabel>Echolog</NavLabel>
          </Link>
        </li>
        <li className="invisible" aria-hidden="true">
          {/* Placeholder for the sticky KO KAIJI wordmark */}
          <span className="tracking-[0.16em]">Ko Kaiji</span>
        </li>
        <li>
          <Link
            href="#portfolio"
            className="k-nav-link"
            onMouseEnter={onEnter}
            onFocus={onFocus}
          >
            <NavLabel>Works</NavLabel>
          </Link>
        </li>
        <li>
          <Link
            href="#contact"
            className="k-nav-link"
            onMouseEnter={onEnter}
            onFocus={onFocus}
          >
            <NavLabel>Contact</NavLabel>
          </Link>
        </li>
      </ul>

      <button
        type="button"
        aria-expanded={menuOpen}
        aria-controls="k-mobile-menu"
        onClick={() => setMenuOpen((v) => !v)}
        className="pointer-events-auto inline-block cursor-pointer text-[14px] tracking-[0.05em] lowercase text-(--ink) [mix-blend-mode:normal] min-[880px]:hidden"
      >
        ({menuOpen ? "close" : "menu"})
      </button>

      {menuOpen && (
        <div
          id="k-mobile-menu"
          className="pointer-events-auto fixed inset-0 z-25 overflow-y-auto bg-(--paper) px-col-2 pt-24 pb-12 text-(--ink) [mix-blend-mode:normal]"
        >
          <ul className="flex flex-col gap-7 text-[22px] uppercase tracking-[0.06em]">
            <li>
              <Link href="#about" onClick={() => setMenuOpen(false)}>
                About
              </Link>
            </li>
            <li>
              <Link href="#" onClick={() => setMenuOpen(false)}>
                Echolog
              </Link>
            </li>
            <li>
              <Link href="/" onClick={() => setMenuOpen(false)}>
                Ko Kaiji
              </Link>
            </li>
            <li>
              <Link href="#portfolio" onClick={() => setMenuOpen(false)}>
                Works
              </Link>
            </li>
            <li>
              <Link href="#contact" onClick={() => setMenuOpen(false)}>
                Contact
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
