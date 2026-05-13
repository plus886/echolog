import { useEffect, useState } from "react";

import { onRippleEnter, onRippleFocus, RippleLabel } from "./nav-ripple";

// Astro Island。旧 app/(public)/portfolio-nav.tsx の移植。
// 旧版は next/link で navigation していたが、phase 3 段階では素の <a> で
// full page nav。phase 5 で <ClientRouter /> を入れれば astro:transitions
// が <a> に soft nav を自動付与する。
//
// 24-col grid に 5 slot (about / echolog / [center spacer] / works /
// contact)。880px 未満は (menu)/(close) toggle に collapse して
// full-bleed overlay を出す。Hover/focus で per-char ripple。
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
      <ul className="k-nav-row pointer-events-auto hidden items-baseline justify-between text-[12px] font-normal uppercase tracking-[0.1em] min-[880px]:flex">
        <li>
          <a
            href="#about"
            className="k-nav-link"
            onMouseEnter={onRippleEnter}
            onFocus={onRippleFocus}
          >
            <RippleLabel>About</RippleLabel>
          </a>
        </li>
        <li>
          <a
            href="#"
            className="k-nav-link"
            onMouseEnter={onRippleEnter}
            onFocus={onRippleFocus}
          >
            <RippleLabel>Echolog</RippleLabel>
          </a>
        </li>
        <li className="invisible" aria-hidden="true">
          {/* Placeholder for the sticky KO KAIJI wordmark */}
          <span className="tracking-[0.16em]">Ko Kaiji</span>
        </li>
        <li>
          <a
            href="#portfolio"
            className="k-nav-link"
            onMouseEnter={onRippleEnter}
            onFocus={onRippleFocus}
          >
            <RippleLabel>Works</RippleLabel>
          </a>
        </li>
        <li>
          <a
            href="#contact"
            className="k-nav-link"
            onMouseEnter={onRippleEnter}
            onFocus={onRippleFocus}
          >
            <RippleLabel>Contact</RippleLabel>
          </a>
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
              <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
            </li>
            <li>
              <a href="#" onClick={() => setMenuOpen(false)}>Echolog</a>
            </li>
            <li>
              <a href="/" onClick={() => setMenuOpen(false)}>Ko Kaiji</a>
            </li>
            <li>
              <a href="#portfolio" onClick={() => setMenuOpen(false)}>Works</a>
            </li>
            <li>
              <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
