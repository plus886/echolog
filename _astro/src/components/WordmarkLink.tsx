import { type CSSProperties, type MouseEvent } from "react";

import { onRippleEnter, onRippleFocus, RippleLabel } from "./nav-ripple";

// Astro Island。旧 app/(public)/wordmark-link.tsx の移植。
// 旧版は TransitionLink (View Transitions API + next/router で SPA 遷移
// を crossfade) で wrap していたが、phase 3 段階では <ClientRouter />
// 未導入なので素の <a> で full page navigation。phase 5 で
// <ClientRouter /> を入れれば astro:transitions が <a> に soft nav と
// View Transitions を自動適用する。
//
// 役割:
//  - 既に / にいる場合: ナビゲーションせず scrollTo top + smooth
//  - 詳細から / に戻る場合: 通常ナビ (ただし ScrollMemory が古いスクロール
//    位置を復元しないよう sessionStorage の k-home-scroll-y をクリア)
//  - PortfolioNav と共通の per-character ripple を hover / focus で
const SCROLL_KEY = "k-home-scroll-y";

export function WordmarkLink({
  className,
  children,
  style,
  "aria-hidden": ariaHidden,
}: {
  className?: string;
  // ripple のため文字単位で span 包みする都合上、children は string で固定。
  children: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    try {
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      // sessionStorage がない / quota 等は無視
    }
    if (window.location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <a
      href="/"
      className={className}
      style={style}
      aria-hidden={ariaHidden}
      onClick={handleClick}
      onMouseEnter={onRippleEnter}
      onFocus={onRippleFocus}
    >
      <RippleLabel>{children}</RippleLabel>
    </a>
  );
}

export default WordmarkLink;
