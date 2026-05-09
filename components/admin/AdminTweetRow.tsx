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
    <article className="border-b border-border last:border-b-0 py-3">
      <p className="whitespace-pre-wrap text-sm">
        {isRetweet ? (
          <span className="text-muted">🔁 自分が RT</span>
        ) : (
          tweet.body ?? "(本文なし)"
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        {isDraft ? (
          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-900">
            下書き
          </span>
        ) : (
          <Link
            href={`/tweets/${tweet.id}`}
            prefetch={false}
            className="hover:underline"
          >
            {formatTweetTimestamp(timestamp)}
          </Link>
        )}

        {!isDraft && !isRetweet && (
          <>
            <Link
              href={`/admin?mode=reply&target=${tweet.id}`}
              prefetch={false}
              className="hover:underline"
            >
              ↩ リプライ
            </Link>
            <Link
              href={`/admin?mode=quote&target=${tweet.id}`}
              prefetch={false}
              className="hover:underline"
            >
              💬 引用RT
            </Link>
            <button
              type="button"
              onClick={handleRetweet}
              disabled={alreadyRetweeted || isRetweeting}
              className="hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
              title={alreadyRetweeted ? "既に RT 済み" : "コメントなし RT"}
            >
              {isRetweeting
                ? "RT 中…"
                : alreadyRetweeted
                  ? "🔁 RT済"
                  : "🔁 RT"}
            </button>
          </>
        )}

        <Link
          href={`/admin/edit/${tweet.id}`}
          prefetch={false}
          className="hover:underline"
        >
          編集
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
            className="text-red-600 hover:underline cursor-pointer"
          >
            削除
          </button>
        </form>
      </div>
    </article>
  );
}
