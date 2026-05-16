import { type CSSProperties, type MouseEvent } from "react";

import { HOME_SCROLL_KEY } from "@/lib/constants";

import { onRippleEnter, onRippleFocus, RippleLabel } from "./NavRipple";

// Astro Island。旧 app/(public)/wordmark-link.tsx の移植。
// 旧版は TransitionLink (View Transitions API + next/router で SPA 遷移
// を crossfade) で wrap していたが、phase 3 段階では <ClientRouter />
// 未導入で素の <a>、phase 5 で <ClientRouter /> を入れて astro:transitions
// が <a> に soft nav と View Transitions を自動適用する状態に。
//
// 役割:
//  - linkable=true (= nav 固定 pin の方): / へのリンクとして機能。
//    既に / にいる場合: ナビゲーションせず scrollTo top + smooth。
//    詳細から / に戻る場合: 通常ナビ (ScrollMemory が古いスクロール位置
//    を復元しないよう sessionStorage の k-home-scroll-y をクリア)。
//    PortfolioNav と共通の per-character ripple を hover / focus で走らせる。
//  - linkable=false (= home hero の中央配置の方): タイポグラフィ要素として
//    のみ表示。リンク機能なし、hover ripple なし、per-character span 分割
//    なし (= プレーン text)。既に / にいて操作する意味がないため、視覚
//    ノイズも全て削ぐ。
//
// label prop の理由:
//   Astro Island の slot 経由で渡される children は React 要素 (内部的に
//   <StaticHtml dangerouslySetInnerHTML> 相当) で plain string にならない
//   ため、RippleLabel が `[...children]` で spread した瞬間に
//   "children is not iterable" で落ちる。文字列のまま受けたい識字情報
//   は children を使わず明示的に label prop として受ける。

export function WordmarkLink({
  label,
  className,
  style,
  "aria-hidden": ariaHidden,
  linkable = true,
}: {
  label: string;
  className?: string;
  style?: CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
  linkable?: boolean;
}) {
  if (!linkable) {
    return (
      <span className={className} style={style} aria-hidden={ariaHidden}>
        {label}
      </span>
    );
  }

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    try {
      sessionStorage.removeItem(HOME_SCROLL_KEY);
    } catch {
      // sessionStorage がない / quota 等は無視
    }
    if (window.location.pathname === "/") {
      e.preventDefault();
      // Lenis が動いている時は Lenis に scrollTo を任せて慣性で戻す。
      // reduced-motion / Lenis 未マウントの環境では native smooth scroll
      // にフォールバック。
      if (window.__lenis) {
        window.__lenis.scrollTo(0);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
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
      <RippleLabel>{label}</RippleLabel>
    </a>
  );
}

export default WordmarkLink;
