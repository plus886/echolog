import type { CSSProperties } from "react";

import { TransitionLink } from "./transition-link";

// Tweet 詳細ページの「参照ブロック」共通枠。
// - parent (In reply to) / retweetOf (Quoting / Retweeted) で同じ
//   左罫線 + label + 本文の組を使うため抽出。
// - clickable で詳細遷移する場合は href を渡す。href 省略時はリンク化せず
//   静的ブロックとして描画する (将来 admin の ModeBanner 等から使いたい
//   場合のため確保)。
// - semantic 切替: as="blockquote" で <blockquote> ラップにする (引用元
//   として意味付けする場合)。デフォルトは <div>。
export function ReferenceCard({
  label,
  body,
  href,
  as = "div",
  className = "",
}: {
  label: string;
  body: string;
  href?: string;
  as?: "div" | "blockquote";
  // 上下 margin など外側のスペーシングだけ呼び出し側で指定する。
  className?: string;
  style?: CSSProperties;
}) {
  const Inner = as;
  const inner = (
    <Inner className="m-0 border-l border-(--ink-30) pl-6 transition-colors hover:border-(--ink-50)">
      <p className="mb-2 k-label-mini">
        {label}
      </p>
      <p className="m-0 whitespace-pre-wrap font-serif text-[15px] leading-[1.8] text-(--ink-70)">
        {body}
      </p>
    </Inner>
  );

  if (!href) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <TransitionLink href={href} className={`block no-underline ${className}`}>
      {inner}
    </TransitionLink>
  );
}
