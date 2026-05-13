import type { TweetTextStatus } from "@/lib/tweet-text";

type Props = {
  status: TweetTextStatus;
};

export function CharCounter({ status }: Props) {
  // 残文字数の色味:
  //  - 警告 / 超過: ink を濃く + italic で「視線が引っかかる」状態
  //  - 通常: ink-50 でひっそり
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
