import type { TweetTextStatus } from "@/lib/tweet-text";

type Props = {
  status: TweetTextStatus;
};

export function CharCounter({ status }: Props) {
  const tone = status.isOver
    ? "text-red-600"
    : status.isWarning
      ? "text-yellow-600"
      : "text-muted";
  return (
    <span className={`tabular-nums text-sm ${tone}`}>
      {status.remaining}
    </span>
  );
}
