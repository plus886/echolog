import { useCallback, useRef, useState } from "react";

import { AdminTweetRow } from "@/components/admin/AdminTweetRow";
import ComposeForm, { type ComposeMode } from "@/components/admin/ComposeForm";
import { cx } from "@/components/admin/ui";
import type { ThreadNode } from "@/lib/thread";
import type { AdminTweet } from "@/types/microcms";

// /admin・/admin/drafts の単一 island。投稿フォームとライブ一覧を束ね、
// 投稿 / 削除 / RT 後に /api/admin/tweets を再フェッチして一覧を最新化する。
// 投稿一覧は親子関係をスレッド化して表示する。

type Filter = "posts" | "drafts";
type ListState = "ready" | "loading" | "error";

type Props = {
  initialThreads: ThreadNode[];
  initialRetweetedTargetIds?: string[];
  initialMode?: ComposeMode;
  initialFilter?: Filter;
};

type RowHandlers = {
  retweetedIds: string[];
  onMutated: () => void;
  onReply: (t: AdminTweet) => void;
  onQuote: (t: AdminTweet) => void;
};

// スレッド1ノードとその子孫を、深さに応じてインデントして描画する。
function ThreadRows({ node, h }: { node: ThreadNode; h: RowHandlers }) {
  return (
    <>
      <div
        style={
          node.depth > 0
            ? { marginInlineStart: Math.min(node.depth, 4) * 16 }
            : undefined
        }
        className={
          node.depth > 0 ? "border-l-2 border-(--ink-15) pl-2" : undefined
        }
      >
        <AdminTweetRow
          tweet={node.tweet}
          retweetedTargetIds={h.retweetedIds}
          onMutated={h.onMutated}
          onReply={h.onReply}
          onQuote={h.onQuote}
        />
      </div>
      {node.children.map((c) => (
        <ThreadRows key={c.tweet.id} node={c} h={h} />
      ))}
    </>
  );
}

export function AdminDashboard({
  initialThreads,
  initialRetweetedTargetIds = [],
  initialMode = { kind: "new" },
  initialFilter = "posts",
}: Props) {
  const [threads, setThreads] = useState(initialThreads);
  const [retweetedIds, setRetweetedIds] = useState(initialRetweetedTargetIds);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [mode, setMode] = useState<ComposeMode>(initialMode);
  const [listState, setListState] = useState<ListState>("ready");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  };

  const refetch = useCallback(async (f: Filter) => {
    setListState("loading");
    try {
      const res = await fetch(
        `/api/admin/tweets${f === "drafts" ? "?status=DRAFT" : ""}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        threads: ThreadNode[];
        retweetedTargetIds: string[];
      };
      setThreads(data.threads);
      setRetweetedIds(data.retweetedTargetIds ?? []);
      setListState("ready");
    } catch {
      setListState("error");
    }
  }, []);

  const changeFilter = (f: Filter) => {
    if (f === filter) return;
    setFilter(f);
    void refetch(f);
  };

  const handlePosted = (kind: "publish" | "draft") => {
    setMode({ kind: "new" });
    const f: Filter = kind === "draft" ? "drafts" : "posts";
    setFilter(f);
    void refetch(f);
    showNotice(kind === "draft" ? "下書きを保存しました" : "投稿しました");
  };

  const startReplyQuote = (kind: "reply" | "quote", t: AdminTweet) => {
    setMode({ kind, target: { id: t.id, body: t.body } });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const composeHeading =
    mode.kind === "reply"
      ? "返信"
      : mode.kind === "quote"
        ? "引用"
        : "新規投稿";

  const rowHandlers: RowHandlers = {
    retweetedIds,
    onMutated: () => void refetch(filter),
    onReply: (t) => startReplyQuote("reply", t),
    onQuote: (t) => startReplyQuote("quote", t),
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-(--ink-15) bg-(--paper) p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-(--ink)">
          {composeHeading}
        </h2>
        <ComposeForm
          mode={mode}
          onPosted={handlePosted}
          onCancelMode={() => setMode({ kind: "new" })}
        />
      </section>

      {notice && (
        <p className="m-0 rounded-md bg-(--ink) px-3 py-2 text-sm text-(--paper)">
          {notice}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-1">
          {(["posts", "drafts"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => changeFilter(f)}
              className={cx(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f
                  ? "bg-(--ink) text-(--paper)"
                  : "text-(--ink-50) hover:bg-(--paper-2)",
              )}
            >
              {f === "posts" ? "投稿" : "下書き"}
            </button>
          ))}
          {listState === "loading" && (
            <span className="ml-2 text-[13px] text-(--ink-50)">更新中…</span>
          )}
        </div>

        {listState === "error" ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            一覧の取得に失敗しました。
            <button
              type="button"
              onClick={() => void refetch(filter)}
              className="ml-2 underline"
            >
              再試行
            </button>
          </div>
        ) : threads.length === 0 ? (
          <p className="m-0 rounded-lg border border-(--ink-15) bg-(--paper) p-6 text-center text-sm text-(--ink-50)">
            {filter === "drafts"
              ? "下書きはありません。"
              : "まだ投稿がありません。"}
          </p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {threads.map((root) => (
              <li key={root.tweet.id} className="flex flex-col gap-2">
                <ThreadRows node={root} h={rowHandlers} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default AdminDashboard;
