import { actions } from "astro:actions";
import { useState, useTransition } from "react";

import { formatPortfolioTimestamp } from "@/lib/format";
import type { AdminTweet } from "@/types/microcms";

// 旧 components/admin/AdminTweetRow.tsx の Astro 移植。
//
// 主な差分:
//  - retweetedTargetIds: 旧版は Set<string>。Astro は Island prop を
//    JSON serialize するため Set はそのまま渡せない。string[] にして
//    Array.includes() で判定。
//  - delete: 旧版は <form action={deleteTweetAction}> + 自動 redirect。
//    Astro Action は redirect 機能が無いので、ボタン onClick で
//    actions.deleteTweet(formData) → 成功時 location.reload() で
//    list を更新する。
//  - retweet: actions.retweet(formData) → エラーは alert で表示
//    (旧版同様の UX)。

type Props = {
  tweet: AdminTweet;
  /** 既に retweet 済みの元ツイート ID 配列 (コメントなし RT は重複不可) */
  retweetedTargetIds?: string[];
};

export function AdminTweetRow({
  tweet,
  retweetedTargetIds = [],
}: Props) {
  const [isRetweeting, startRetweet] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const isDraft = !tweet.publishedAt;
  const timestamp = tweet.publishedAt ?? tweet.updatedAt;
  const isRetweet = tweet.retweetType?.[0] === "retweet";
  const alreadyRetweeted = retweetedTargetIds.includes(tweet.id);
  const [retweetState, setRetweetState] = useState<"idle" | "done">(
    alreadyRetweeted ? "done" : "idle",
  );

  const handleRetweet = () => {
    if (retweetState === "done" || isRetweet || isDraft) return;
    if (!confirm("このツイートを RT しますか？")) return;
    const formData = new FormData();
    formData.set("targetId", tweet.id);
    startRetweet(async () => {
      const result = await actions.retweet(formData);
      if (result.error) {
        alert(result.error.message);
      } else {
        setRetweetState("done");
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
        // list を更新するため reload
        window.location.reload();
      }
    });
  };

  return (
    <article className="py-5">
      <p className="m-0 whitespace-pre-wrap font-serif text-[15px] leading-[1.8] text-(--ink)">
        {isRetweet ? (
          <span className="k-label-mini not-italic">↻ self retweet</span>
        ) : (
          tweet.body ?? (
            <span className="italic text-(--ink-50)">(本文なし)</span>
          )
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] uppercase tracking-[0.12em] text-(--ink-50)">
        {isDraft ? (
          <span className="border border-(--ink-30) px-2 py-0.5 italic text-(--ink-70)">
            draft
          </span>
        ) : (
          <a
            href={`/tweets/${tweet.id}`}
            className="normal-case tracking-normal transition-opacity hover:opacity-60"
          >
            {formatPortfolioTimestamp(timestamp)}
          </a>
        )}

        {!isDraft && !isRetweet && (
          <>
            <a
              href={`/admin?mode=reply&target=${tweet.id}`}
              className="lowercase transition-opacity hover:opacity-60"
            >
              reply
            </a>
            <a
              href={`/admin?mode=quote&target=${tweet.id}`}
              className="lowercase transition-opacity hover:opacity-60"
            >
              quote
            </a>
            <button
              type="button"
              onClick={handleRetweet}
              disabled={retweetState === "done" || isRetweeting}
              className="cursor-pointer lowercase transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                retweetState === "done" ? "既に RT 済み" : "コメントなし RT"
              }
            >
              {isRetweeting
                ? "retweeting…"
                : retweetState === "done"
                  ? "↻ retweeted"
                  : "↻ retweet"}
            </button>
          </>
        )}

        <a
          href={`/admin/edit/${tweet.id}`}
          className="lowercase transition-opacity hover:opacity-60"
        >
          edit
        </a>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="cursor-pointer italic lowercase tracking-normal text-(--ink-70) transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isDeleting ? "deleting…" : "delete"}
        </button>
      </div>
    </article>
  );
}

export default AdminTweetRow;
