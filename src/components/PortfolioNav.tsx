import { useEffect, useState } from "react";

import { defaultLocale, localeUrl, t, type Locale } from "@/lib/i18n";

import { onRippleEnter, onRippleFocus, RippleLabel } from "./NavRipple";

// Astro Island。リンクは素の <a> で full page nav (phase 5 で
// <ClientRouter /> を入れれば astro:transitions が soft nav を自動付与)。
//
// 24-col grid に 5 slot (about / echolog / [center spacer] / works /
// contact)。880px 未満は hamburger / close アイコンの toggle に collapse
// して full-bleed overlay を出す。Hover/focus で per-char ripple。
//
// chrome は mix-blend-difference の透明フローティング nav (デスクトップ /
// モバイル共通)。モバイルメニューは header の外に出した full-screen overlay
// で、nav リンク + follow / contact / copyright を含む。
//
// i18n: href は locale 接頭辞込み (zh は /zh 配下)、ラベルは t() 経由。

// モバイル toggle のアイコン。site のミニマルな雰囲気に合わせた細線
// (stroke-width 1) の line icon。色は currentColor 継承。
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  strokeLinecap: "round" as const,
  "aria-hidden": true,
};

function MenuIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="2.5" y1="7" x2="17.5" y2="7" />
      <line x1="2.5" y1="13" x2="17.5" y2="13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...ICON_PROPS}>
      <line x1="4.5" y1="4.5" x2="15.5" y2="15.5" />
      <line x1="15.5" y1="4.5" x2="4.5" y2="15.5" />
    </svg>
  );
}

export function PortfolioNav({ locale = defaultLocale }: { locale?: Locale }) {
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

  const href = (path: string) => localeUrl(path, locale);
  const year = new Date().getFullYear();

  return (
    <>
      <header className="k-nav pointer-events-none fixed inset-x-0 top-0 z-20 mix-blend-difference px-col-1 pt-9 text-(--grey-light)">
        <ul className="k-nav-row pointer-events-auto hidden items-baseline justify-between text-[12px] font-normal uppercase tracking-[0.1em] min-[880px]:flex">
          <li>
            <a
              href={href("/#about")}
              className="k-nav-link"
              onMouseEnter={onRippleEnter}
              onFocus={onRippleFocus}
            >
              <RippleLabel>{t(locale, "nav.about")}</RippleLabel>
            </a>
          </li>
          <li>
            <a
              href={href("/#echolog")}
              className="k-nav-link"
              onMouseEnter={onRippleEnter}
              onFocus={onRippleFocus}
            >
              <RippleLabel>{t(locale, "nav.echolog")}</RippleLabel>
            </a>
          </li>
          <li className="invisible" aria-hidden="true">
            {/* Placeholder for the sticky KO KAIJI wordmark */}
            <span className="tracking-[0.16em]">Ko Kaiji</span>
          </li>
          <li>
            <a
              href={href("/#works")}
              className="k-nav-link"
              onMouseEnter={onRippleEnter}
              onFocus={onRippleFocus}
            >
              <RippleLabel>{t(locale, "nav.works")}</RippleLabel>
            </a>
          </li>
          <li>
            <a
              href={href("/#contact")}
              className="k-nav-link"
              onMouseEnter={onRippleEnter}
              onFocus={onRippleFocus}
            >
              <RippleLabel>{t(locale, "nav.contact")}</RippleLabel>
            </a>
          </li>
        </ul>

        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="k-mobile-menu"
          aria-label={menuOpen ? t(locale, "nav.close") : t(locale, "nav.menu")}
          onClick={() => setMenuOpen((v) => !v)}
          className="pointer-events-auto -ml-2 inline-flex cursor-pointer p-2 text-(--ink) [mix-blend-mode:normal] min-[880px]:hidden"
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </header>

      {/* モバイルメニュー overlay。
          - .k-nav は transform を持つため、その子に置くと fixed の包含
            ブロックが header になり全画面化しない → header の外 (兄弟) に。
          - 常時マウントして class トグル (条件描画だと閉じるアニメーション
            が効かない)。inert で閉じている間の focus / a11y を遮断。 */}
      <div
        id="k-mobile-menu"
        inert={!menuOpen}
        className={`fixed inset-0 z-25 flex flex-col overflow-y-auto bg-(--paper) px-col-2 pt-9 pb-12 text-(--ink) transition-opacity duration-300 ease-out [mix-blend-mode:normal] motion-reduce:transition-none ${
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        {/* 上段: ブランド + 閉じる。ヘッダーの (close) トグルは overlay の
              裏に隠れるため、overlay 自身に確実なクローズ手段を持たせる。 */}
        <div className="flex items-baseline justify-between">
          <a
            href={href("/")}
            onClick={() => setMenuOpen(false)}
            className="text-[14px] tracking-[0.16em] text-(--ink) uppercase no-underline"
          >
            KO KAIJI
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label={t(locale, "nav.close")}
            className="-mr-2 inline-flex cursor-pointer p-2 text-(--ink-50) transition-opacity hover:opacity-60"
          >
            <CloseIcon />
          </button>
        </div>

        <ul className="mt-16 flex flex-col gap-5 text-[22px] uppercase tracking-[0.06em]">
          <li>
            <a
              href={href("/#about")}
              onClick={() => setMenuOpen(false)}
              className="transition-opacity hover:opacity-60"
            >
              {t(locale, "nav.about")}
            </a>
          </li>
          <li>
            <a
              href={href("/#echolog")}
              onClick={() => setMenuOpen(false)}
              className="transition-opacity hover:opacity-60"
            >
              {t(locale, "nav.echolog")}
            </a>
          </li>
          <li>
            <a
              href={href("/#works")}
              onClick={() => setMenuOpen(false)}
              className="transition-opacity hover:opacity-60"
            >
              {t(locale, "nav.works")}
            </a>
          </li>
          <li>
            <a
              href={href("/#contact")}
              onClick={() => setMenuOpen(false)}
              className="transition-opacity hover:opacity-60"
            >
              {t(locale, "nav.contact")}
            </a>
          </li>
        </ul>

        {/* follow — フッターと同じ外部リンク */}
        <div className="mt-auto pt-16">
          <p className="m-0 text-[12px] tracking-[0.08em] text-(--ink-50) lowercase">
            (follow)
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-[15px]">
            <li>
              <a
                href="https://note.com/plus886note"
                target="_blank"
                rel="noreferrer"
                className="transition-opacity hover:opacity-60"
              >
                note
              </a>
            </li>
            <li>
              <a
                href="https://www.facebook.com/koichiro.ideta"
                target="_blank"
                rel="noreferrer"
                className="transition-opacity hover:opacity-60"
              >
                facebook
              </a>
            </li>
          </ul>
        </div>

        {/* contact */}
        <div className="mt-8">
          <p className="m-0 text-[12px] tracking-[0.08em] text-(--ink-50) lowercase">
            (contact)
          </p>
          <a
            href="mailto:kokaiji.tw@gmail.com"
            className="mt-2 inline-block text-[15px] transition-opacity hover:opacity-60"
          >
            kokaiji.tw@gmail.com
          </a>
        </div>

        <p className="mt-10 text-center text-[12px] text-(--ink-50)">
          © {year} Ko Kaiji
        </p>
      </div>
    </>
  );
}

export default PortfolioNav;
