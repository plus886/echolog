"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Helper: each visible label is duplicated as two stacked spans so the
// hover handler in CSS can slide the original up out of frame and the
// clone into frame from below — vertical "flip" effect.
function NavLabel({ children }: { children: string }) {
  return (
    <span className="k-nav-text" aria-hidden="true">
      <span className="before">{children}</span>
      <span className="after">{children}</span>
      <span className="visually-hidden">{children}</span>
    </span>
  );
}

// Top nav skeleton:
//  - 5 slots distributed across a 24-column grid (brand · portfolio ·
//    information w/ dropdown · about · contact, last item right-aligned)
//  - mix-blend-difference so chrome stays legible against any background
//  - Below 880px the row collapses to a (menu) / (close) toggle that
//    opens a full-bleed overlay
//  - .k-nav-* class hooks remain so portfolio.css can drive the
//    slide-up label animation, the underline draw, and the parent-state
//    show/hide cascade from .k-shell.is-scrolled
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
      <ul className="k-nav-row pointer-events-auto hidden items-baseline text-[12px] font-normal uppercase tracking-[0.1em] min-[880px]:flex">
        <li className="k-nav-brand col-5 tracking-[0.16em]">
          <Link href="/" className="k-nav-link">
            <NavLabel>Ko Kaiji</NavLabel>
          </Link>
        </li>
        <li className="col-4">
          <Link href="#portfolio" className="k-nav-link">
            <NavLabel>Portfolio</NavLabel>
          </Link>
        </li>
        <li className="k-nav-dropdown col-8 relative">
          <span className="k-nav-link k-nav-trigger">
            <NavLabel>Information</NavLabel>
          </span>
          <ul className="k-nav-sub absolute left-1/5 top-full mt-3 flex flex-col gap-1.5 text-[12px] tracking-[0.04em] lowercase">
            <li>
              <Link href="#portfolio">Series</Link>
            </li>
            <li>
              <Link href="#portfolio">Editions</Link>
            </li>
          </ul>
        </li>
        <li className="col-3 ml-auto">
          <Link href="#about" className="k-nav-link">
            <NavLabel>About</NavLabel>
          </Link>
        </li>
        <li className="k-nav-end col-2 text-right">
          <Link href="#contact" className="k-nav-link">
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
              <Link href="/" onClick={() => setMenuOpen(false)}>Home</Link>
            </li>
            <li>
              <Link href="#portfolio" onClick={() => setMenuOpen(false)}>
                Portfolio
              </Link>
            </li>
            <li>
              <span className="mb-3 block">Information</span>
              <ul className="ml-4 flex flex-col gap-2.5 text-[16px] lowercase text-(--ink-70)">
                <li>
                  <Link href="#portfolio" onClick={() => setMenuOpen(false)}>
                    Series
                  </Link>
                </li>
                <li>
                  <Link href="#portfolio" onClick={() => setMenuOpen(false)}>
                    Editions
                  </Link>
                </li>
              </ul>
            </li>
            <li>
              <Link href="#about" onClick={() => setMenuOpen(false)}>About</Link>
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
