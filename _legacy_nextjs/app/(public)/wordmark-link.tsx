"use client";

import { type CSSProperties, type MouseEvent } from "react";

import { onRippleEnter, onRippleFocus, RippleLabel } from "./nav-ripple";
import { TransitionLink } from "./transition-link";

// KO KAIJI ワードマーク用の link wrapper。
// - 既に / にいる場合: ナビゲーションせず scrollTo top + smooth
// - 詳細ページから / に戻る場合: 通常の TransitionLink ナビゲーション
//   (ただし ScrollMemory が後で「最後のスクロール位置」を復元しないよう
//   sessionStorage を事前にクリアして、確実にトップへ着地させる)
// - PortfolioNav のリンクと同じ per-character opacity ripple をホバー
//   / focus で発火させる (ロジックは ./nav-ripple.tsx に集約)
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
      // sessionStorage がない / quota 等の例外は無視
    }
    if (window.location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <TransitionLink
      href="/"
      className={className}
      style={style}
      aria-hidden={ariaHidden}
      onClick={handleClick}
      onMouseEnter={onRippleEnter}
      onFocus={onRippleFocus}
    >
      <RippleLabel>{children}</RippleLabel>
    </TransitionLink>
  );
}
