"use client";

import Link from "next/link";

import { deleteTweetAction } from "@/app/(admin)/admin/_actions";
import { formatTweetTimestamp } from "@/lib/format";
import type { AdminTweet } from "@/types/microcms";

type Props = {
  tweet: AdminTweet;
};

export function AdminTweetRow({ tweet }: Props) {
  const timestamp = tweet.publishedAt ?? tweet.updatedAt;
  const isDraft = !tweet.publishedAt;

  return (
    <article className="border-b border-border last:border-b-0 py-3">
      <p className="whitespace-pre-wrap text-sm">{tweet.body ?? "(本文なし)"}</p>

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
