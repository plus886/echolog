import type { TweetTextStatus } from "@/lib/tweet-text";

// ComposeForm / EditForm 内で使う pure な小コンポーネント。Island 境界の
// 内側に住むので "use client" 不要、独自 client directive も不要。

type Props = {
  status: TweetTextStatus;
};

export function CharCounter({ status }: Props) {
  const tone =
    status.isOver || status.isWarning
      ? "text-(--ink) italic"
      : "text-(--ink-50)";
  return (
    <span
      className={`tabular-nums font-serif text-[15px] tracking-[0.04em] ${tone}`}
    >
      {status.remaining}
    </span>
  );
}
