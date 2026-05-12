"use client";

import NextLink, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    children?: ReactNode;
  };

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void | Promise<void>) => {
    finished?: Promise<void>;
  };
};

// next/link をラップしてクライアントサイド遷移を View Transitions API
// (document.startViewTransition) で包む。crossfade を含む native page
// transition がブラウザネイティブに動く。Firefox 等未サポート環境では
// 即時遷移 (graceful degradation)。
//
// 遷移中の transient な class 変化 (Next.js が scrollTo(0) を発火して
// 旧 home の ScrollWordmark が .is-scrolled を一瞬外し、続いて NavState
// が再付与する、など) で CSS transition が走らないよう、クリック直後に
// .no-shell-transitions を付与し、view transition 完了後に解除する。
// 加えて、callback から Promise を返すことで「after」snapshot を NavState
// の useLayoutEffect 完了後まで遅らせる。
export function TransitionLink({
  href,
  onClick,
  children,
  ...rest
}: Props) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    if (typeof href !== "string") return;

    e.preventDefault();

    // 1) ScrollWordmark に「ナビゲーション中はスクロールに反応するな」
    //    と教えるための flag。<html data-navigating="1"> を建てる。
    //    Next.js のクライアント遷移は scrollTo(0) を発火するので、これが
    //    無いと旧 home の listener が一瞬 .is-scrolled を外してしまう。
    document.documentElement.dataset.navigating = "1";

    // 2) もし nav が表示中なら、保険として transform をインラインで pin。
    //    View Transition の OLD/NEW snapshot の両方で nav 位置が固定される。
    const shell = document.querySelector<HTMLElement>(".k-shell");
    const nav = shell?.querySelector<HTMLElement>(".k-nav") ?? null;
    const pinNav = shell?.classList.contains("is-scrolled") ?? false;
    if (pinNav && nav) {
      nav.style.transform = "translateY(0)";
      nav.style.transition = "none";
    }
    // 3) すべての shell transition を一時的に切る。NavState が遷移先で
    //    is-scrolled を付与し直す時の slide も抑える。
    shell?.classList.add("no-shell-transitions");

    const restore = () => {
      delete document.documentElement.dataset.navigating;
      shell?.classList.remove("no-shell-transitions");
      if (pinNav && nav) {
        nav.style.transform = "";
        nav.style.transition = "";
      }
    };

    const doc = document as ViewTransitionDocument;
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(() => router.push(href));
    } else {
      router.push(href);
    }
    // transition.finished は Turbopack 環境では早期 resolve することが
    // あるので使わず、view-transition の crossfade (≈420ms) + NavState の
    // useLayoutEffect 完了をカバーする固定 1000ms を採用。
    setTimeout(restore, 1000);
  };

  return (
    <NextLink href={href} {...rest} onClick={handleClick}>
      {children}
    </NextLink>
  );
}
