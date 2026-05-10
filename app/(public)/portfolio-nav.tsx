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

// Top nav with the same skeleton as the reference:
//  - 5 slots distributed across a 24-column grid (brand · portfolio ·
//    information w/ dropdown · about · contact, last item right-aligned)
//  - mix-blend-mode: difference so the chrome stays visible against
//    cream paper or any photo it crosses on scroll
//  - Below ~880px collapses to only the brand + a (menu) toggle that
//    swaps to a full-bleed overlay
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
    <header className="k-nav">
      <ul className="k-nav-row">
        <li className="k-nav-brand">
          <Link href="/" className="k-nav-link">
            <NavLabel>Ko Kaiji</NavLabel>
          </Link>
        </li>
        <li>
          <Link href="#portfolio" className="k-nav-link">
            <NavLabel>Portfolio</NavLabel>
          </Link>
        </li>
        <li className="k-nav-dropdown">
          <span className="k-nav-link k-nav-trigger">
            <NavLabel>Information</NavLabel>
          </span>
          <ul className="k-nav-sub">
            <li><Link href="#portfolio">Series</Link></li>
            <li><Link href="#portfolio">Editions</Link></li>
          </ul>
        </li>
        <li>
          <Link href="#about" className="k-nav-link">
            <NavLabel>About</NavLabel>
          </Link>
        </li>
        <li className="k-nav-end">
          <Link href="#contact" className="k-nav-link">
            <NavLabel>Contact</NavLabel>
          </Link>
        </li>
      </ul>

      <button
        type="button"
        className="k-nav-toggle"
        aria-expanded={menuOpen}
        aria-controls="k-mobile-menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        ({menuOpen ? "close" : "menu"})
      </button>

      {menuOpen && (
        <div id="k-mobile-menu" className="k-nav-overlay">
          <ul>
            <li><Link href="/" onClick={() => setMenuOpen(false)}>Home</Link></li>
            <li><Link href="#portfolio" onClick={() => setMenuOpen(false)}>Portfolio</Link></li>
            <li className="k-nav-overlay-group">
              <span>Information</span>
              <ul>
                <li><Link href="#portfolio" onClick={() => setMenuOpen(false)}>Series</Link></li>
                <li><Link href="#portfolio" onClick={() => setMenuOpen(false)}>Editions</Link></li>
              </ul>
            </li>
            <li><Link href="#about" onClick={() => setMenuOpen(false)}>About</Link></li>
            <li><Link href="#contact" onClick={() => setMenuOpen(false)}>Contact</Link></li>
          </ul>
        </div>
      )}
    </header>
  );
}
