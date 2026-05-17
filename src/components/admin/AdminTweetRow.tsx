import { actions } from "astro:actions";
import { useState, useTransition } from "react";

import { cx } from "@/components/admin/ui";
import { formatPortfolioTimestamp } from "@/lib/format";
import type { AdminTweet } from "@/types/microcms";

// 一覧の1行。日本語と台湾華語訳を併記する。投稿の変更 (削除 / RT) は
// onMutated で親へ通知し、親が一覧を再フェッチする。reply / quote は
// onReply / onQuote で親 (ComposeForm の mode) へ渡す。

type Props = {
  tweet: AdminTweet;
  retweetedTargetIds?: string[];
  onMutated?: () => void;
  onReply?: (tweet: AdminTweet) => void;
  onQuote?: (tweet: AdminTweet) => void;
};

const actionCls =
  "rounded px-2 py-1 text-[13px] text-(--ink-70) transition-colors hover:bg-(--paper-2) hover:text-(--ink) disabled:cursor-not-allowed disabled:opacity-40";

function BodyCell({
  label,
  text,
  muted,
}: {
  label: string;
  text?: string;
  muted?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="m-0 mb-1 text-[10px] font-medium tracking-wide text-(--ink-50) uppercase">
        {label}
      </p>
      {text ? (
        <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap text-(--ink)">
          {text}
        </p>
      ) : (
        <p className="m-0 text-sm text-(--ink-50) italic">{muted}</p>
      )}
    </div>
  );
}

export function AdminTweetRow({
  tweet,
  retweetedTargetIds = [],
  onMutated,
  onReply,
  onQuote,
}: Props) {
  const [isRetweeting, startRetweet] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const isDraft = !tweet.publishedAt;
  const timestamp = tweet.publishedAt ?? tweet.updatedAt;
  const isRetweet = tweet.retweetType?.[0] === "retweet";
  const alreadyRetweeted = retweetedTargetIds.includes(tweet.id);
  const [retweetDone, setRetweetDone] = useState(alreadyRetweeted);
  const images = tweet.images ?? [];
  const hasText = Boolean(tweet.body || tweet.bodyZh);

  const handleRetweet = () => {
    if (retweetDone || isRetweet || isDraft) return;
    if (!confirm("このツイートをリツイートしますか？")) return;
    const formData = new FormData();
    formData.set("targetId", tweet.id);
    startRetweet(async () => {
      const result = await actions.retweet(formData);
      if (result.error) {
        alert(result.error.message);
      } else {
        setRetweetDone(true);
        onMutated?.();
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("このツイートを削除しますか？")) return;
    const formData = new FormData();
    formData.set("id", tweet.id);
    startDelete(async () => {
      const result = await actions.deleteTweet(formData);
      if (result.error) {
        alert(result.error.message);
      } else {
        onMutated?.();
      }
    });
  };

  return (
    <article className="rounded-lg border border-(--ink-15) bg-(--paper) p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        {isDraft && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
            下書き
          </span>
        )}
        {isRetweet && (
          <span className="rounded bg-(--paper-2) px-1.5 py-0.5 font-medium text-(--ink-70)">
            リツイート
          </span>
        )}
        {isDraft ? (
          <span className="text-(--ink-50)">
            {formatPortfolioTimestamp(timestamp)}
          </span>
        ) : (
          <a
            href={`/tweets/${tweet.id}`}
            className="text-(--ink-50) transition-opacity hover:opacity-60"
          >
            {formatPortfolioTimestamp(timestamp)}
          </a>
        )}
      </div>

      {isRetweet ? (
        <p className="m-0 text-sm text-(--ink-50)">↻ コメントなしリツイート</p>
      ) : hasText ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <BodyCell label="日本語" text={tweet.body} muted="(本文なし)" />
          <BodyCell label="台湾華語" text={tweet.bodyZh} muted="(未翻訳)" />
        </div>
      ) : (
        <p className="m-0 text-sm text-(--ink-50) italic">(本文なし)</p>
      )}

      {images.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {images.map((img) => (
            <li key={img.url} className="m-0 p-0">
              <img
                src={`${img.url}?w=120&h=120&fit=crop`}
                alt=""
                loading="lazy"
                className="h-14 w-14 rounded bg-(--paper-2) object-cover"
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-(--ink-15) pt-2">
        {!isDraft && !isRetweet && (
          <>
            <button
              type="button"
              className={actionCls}
              onClick={() => onReply?.(tweet)}
            >
              返信
            </button>
            <button
              type="button"
              className={actionCls}
              onClick={() => onQuote?.(tweet)}
            >
              引用
            </button>
            <button
              type="button"
              className={actionCls}
              onClick={handleRetweet}
              disabled={retweetDone || isRetweeting}
            >
              {isRetweeting
                ? "RT中…"
                : retweetDone
                  ? "↻ RT済み"
                  : "↻ リツイート"}
            </button>
          </>
        )}
        <a href={`/admin/edit/${tweet.id}`} className={actionCls}>
          編集
        </a>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className={cx(
            actionCls,
            "ml-auto text-red-700 hover:bg-red-50 hover:text-red-800",
          )}
        >
          {isDeleting ? "削除中…" : "削除"}
        </button>
      </div>
    </article>
  );
}

export default AdminTweetRow;
