"use client";

import Link from "next/link";
import { useTransition } from "react";

import {
  deleteTweetAction,
  retweetAction,
} from "@/app/(admin)/admin/_actions";
import { formatTweetTimestamp } from "@/lib/format";
import type { AdminTweet } from "@/types/microcms";

type Props = {
  tweet: AdminTweet;
  /** 既に retweet 済みの元ツイート ID 集合（コメントなし RT は重複不可） */
  retweetedTargetIds?: Set<string>;
};

export function AdminTweetRow({
  tweet,
  retweetedTargetIds = new Set(),
}: Props) {
  const [isRetweeting, startRetweet] = useTransition();
  const isDraft = !tweet.publishedAt;
  const timestamp = tweet.publishedAt ?? tweet.updatedAt;
  // 自身が retweet ツイートの場合は対象操作のターゲットではない
  const isRetweet = tweet.retweetType?.[0] === "retweet";
  const alreadyRetweeted = retweetedTargetIds.has(tweet.id);

  const handleRetweet = () => {
    if (alreadyRetweeted || isRetweet || isDraft) return;
    if (!confirm("このツイートを RT しますか？")) return;
    const formData = new FormData();
    formData.set("targetId", tweet.id);
    startRetweet(async () => {
      const result = await retweetAction(formData);
      if (!result.ok) alert(result.error);
    });
  };

  return (
    <article className="py-5">
      <p className="m-0 whitespace-pre-wrap font-serif text-[15px] leading-[1.8] text-(--ink)">
        {isRetweet ? (
          <span className="text-[11px] uppercase tracking-[0.16em] text-(--ink-50) not-italic">
            ↻ self retweet
          </span>
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
          <Link
            href={`/tweets/${tweet.id}`}
            prefetch={false}
            className="normal-case tracking-normal transition-opacity hover:opacity-60"
          >
            {formatTweetTimestamp(timestamp)}
          </Link>
        )}

        {!isDraft && !isRetweet && (
          <>
            <Link
              href={`/admin?mode=reply&target=${tweet.id}`}
              prefetch={false}
              className="lowercase transition-opacity hover:opacity-60"
            >
              reply
            </Link>
            <Link
              href={`/admin?mode=quote&target=${tweet.id}`}
              prefetch={false}
              className="lowercase transition-opacity hover:opacity-60"
            >
              quote
            </Link>
            <button
              type="button"
              onClick={handleRetweet}
              disabled={alreadyRetweeted || isRetweeting}
              className="cursor-pointer lowercase transition-opacity hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
              title={alreadyRetweeted ? "既に RT 済み" : "コメントなし RT"}
            >
              {isRetweeting
                ? "retweeting…"
                : alreadyRetweeted
                  ? "↻ retweeted"
                  : "↻ retweet"}
            </button>
          </>
        )}

        <Link
          href={`/admin/edit/${tweet.id}`}
          prefetch={false}
          className="lowercase transition-opacity hover:opacity-60"
        >
          edit
        </Link>
        <form
          action={deleteTweetAction}
          onSubmit={(e) => {
            if (!confirm("このツイートを削除しますか？")) e.preventDefault();
          }}
          className="inline"
        >
          <input type="hidden" name="id" value={tweet.id} />
          <button
            type="submit"
            className="cursor-pointer italic lowercase tracking-normal text-(--ink-70) transition-opacity hover:opacity-60"
          >
            delete
          </button>
        </form>
      </div>
    </article>
  );
}
