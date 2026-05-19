import type { TweetTextStatus } from "@/lib/tweet-text";

// ComposeForm / EditForm 内で使う pure な小コンポーネント。残り文字数表示。

type Props = {
  status: TweetTextStatus;
};

export function CharCounter({ status }: Props) {
  const tone = status.isOver
    ? "text-error"
    : status.isWarning
      ? "text-warning"
      : "text-base-content/50";
  return (
    <span className={`text-sm tabular-nums ${tone}`}>{status.remaining}</span>
  );
}
