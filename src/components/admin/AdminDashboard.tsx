import { useCallback, useRef, useState } from "react";

import { AdminTweetRow } from "@/components/admin/AdminTweetRow";
import ComposeForm, {
  type ComposeMode,
  type SeededBody,
} from "@/components/admin/ComposeForm";
import TweetSuggestDialog from "@/components/admin/TweetSuggestDialog";
import { Card, cx } from "@/components/admin/ui";
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
          node.depth > 0 ? "border-l-2 border-base-300 pl-2" : undefined
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
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [seededBody, setSeededBody] = useState<SeededBody>();
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
    // 返信は常に root (1階層目) に対して行う。クリックしたツイートが既に
    // 返信ならその parent を対象にし、3階層目以降を作らないようにする。
    // (引用は別ツイートとして紐付くので flatten は不要。)
    const target =
      kind === "reply" && t.parent
        ? { id: t.parent.id, body: t.parent.body }
        : { id: t.id, body: t.body };
    setMode({ kind, target });
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
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-semibold">{composeHeading}</h2>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setSuggestOpen(true)}
          >
            AI で提案
          </button>
        </div>
        <ComposeForm
          mode={mode}
          onPosted={handlePosted}
          onCancelMode={() => setMode({ kind: "new" })}
          seededBody={seededBody}
        />
      </Card>

      {notice && (
        <div className="alert alert-success text-sm">
          <span>{notice}</span>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-1">
          {(["posts", "drafts"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => changeFilter(f)}
              className={cx(
                "btn btn-sm",
                filter === f ? "btn-primary" : "btn-ghost",
              )}
            >
              {f === "posts" ? "投稿" : "下書き"}
            </button>
          ))}
          {listState === "loading" && (
            <span className="ml-2 text-[13px] text-base-content/50">
              更新中…
            </span>
          )}
        </div>

        {listState === "error" ? (
          <div className="alert alert-error text-sm">
            <span>一覧の取得に失敗しました。</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void refetch(filter)}
            >
              再試行
            </button>
          </div>
        ) : threads.length === 0 ? (
          <p className="m-0 rounded-lg border border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/50">
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

      {suggestOpen && (
        <TweetSuggestDialog
          onClose={() => setSuggestOpen(false)}
          onAdopt={(text) => setSeededBody({ text, nonce: Date.now() })}
        />
      )}
    </div>
  );
}

export default AdminDashboard;
