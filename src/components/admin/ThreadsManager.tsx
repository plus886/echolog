import { actions } from "astro:actions";
import { useCallback, useEffect, useState } from "react";

import { Button, Card, ErrorAlert } from "@/components/admin/ui";
import {
  formatTaipei,
  isoToTaipeiInput,
  taipeiInputToIso,
} from "@/lib/taipei-time";

// Threads タブ = 接続管理 + 予約投稿ダッシュボード。
//  - 予約キュー: 予約中 / 実行中 / 失敗 (時系列昇順)。日時編集・取消・
//    今すぐ投稿・投稿前プレビュー (先頭40字のフィード見え方 + 画像縦横比)。
//  - 投稿ログ: 投稿済み / 削除済み (新しい順)。permalink・失敗注記。
// 返信・表示回数は次フェーズでログ側に足す。
//
// 接続フロー: 「Threads と接続」→ /admin/threads/oauth/start → Meta の
// 認可画面 → callback が D1 にトークンを保存 → /admin?threads=connected に
// 戻る。mount 時にそのクエリを拾って結果を表示し、URL からは消す。

type ConnStatus =
  | { appConfigured: boolean; connected: false }
  | {
      appConfigured: boolean;
      connected: true;
      username: string | null;
      threadsUserId: string;
      expiresAt: string;
      refreshedAt: string;
      tokenOk?: boolean;
    };

type PostItem = {
  id: number;
  dayId: string;
  imageUrl: string;
  scheduledAt: string;
  status: "scheduled" | "publishing" | "published" | "failed" | "deleted";
  postedText: string | null;
  threadsPermalink: string | null;
  error: string | null;
  publishedAt: string | null;
  passageZh: string | null;
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: "認可がキャンセルされました",
  state: "state の検証に失敗しました。もう一度お試しください",
  exchange: "トークンの取得に失敗しました。サーバログを確認してください",
};

const DAY_URL_BASE = "https://photo.kokaiji.tw/zh/days/";

function formatDateTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// フィードでの見え方の目安。先頭 40 字を強調し、残りを折りたたみ扱いで
// 薄く見せる。
function FeedPreview({ text }: { text: string }) {
  const head = text.slice(0, 40);
  const rest = text.slice(40);
  return (
    <p className="m-0 text-sm leading-relaxed whitespace-pre-wrap">
      <span>{head}</span>
      {rest && <span className="opacity-40">{rest}</span>}
    </p>
  );
}

// 画像の縦横比チェック。読み込んでから naturalWidth/Height で判定する。
// Threads は極端な比率 (10:1 超) を受け付けない。縦長はフィードで
// トリミングされうるので注意表示のみ。
function AspectNote({ ratio }: { ratio: number | null }) {
  if (ratio === null) return null;
  if (ratio > 10 || ratio < 0.1) {
    return (
      <span className="badge badge-error badge-sm">
        縦横比 {ratio.toFixed(2)} — 投稿に失敗する可能性 (10:1 超)
      </span>
    );
  }
  if (ratio < 0.8) {
    return (
      <span className="badge badge-warning badge-sm">
        縦長 {ratio.toFixed(2)} — フィードでは上下が切れる場合あり
      </span>
    );
  }
  return (
    <span className="badge badge-ghost badge-sm">
      縦横比 {ratio.toFixed(2)} OK
    </span>
  );
}

const STATUS_BADGE: Record<PostItem["status"], [string, string]> = {
  scheduled: ["badge-info", "予約中"],
  publishing: ["badge-warning", "実行中"],
  published: ["badge-success", "投稿済み"],
  failed: ["badge-error", "失敗"],
  deleted: ["badge-ghost", "削除済み"],
};

function StatusBadge({ status }: { status: PostItem["status"] }) {
  const [cls, label] = STATUS_BADGE[status];
  return <span className={`badge badge-sm ${cls}`}>{label}</span>;
}

// ---- キュー 1 行 ----

function QueueRow({
  post,
  busy,
  onReschedule,
  onCancel,
  onPublishNow,
}: {
  post: PostItem;
  busy: boolean;
  onReschedule: (id: number, iso: string) => Promise<string | null>;
  onCancel: (id: number) => Promise<void>;
  onPublishNow: (id: number) => Promise<void>;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const [timeValue, setTimeValue] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  const text = post.passageZh ?? post.postedText ?? "";

  const startTimeEdit = () => {
    setTimeValue(isoToTaipeiInput(post.scheduledAt));
    setTimeError(null);
    setEditingTime(true);
  };

  const saveTime = async () => {
    const iso = taipeiInputToIso(timeValue);
    if (!iso) {
      setTimeError("日時の形式が不正です");
      return;
    }
    const error = await onReschedule(post.id, iso);
    if (error) {
      setTimeError(error);
      return;
    }
    setEditingTime(false);
  };

  return (
    <div className="rounded-lg border border-base-300 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`${DAY_URL_BASE}${post.dayId}`}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={`${post.imageUrl}?w=120&fm=webp`}
            alt=""
            className="h-12 w-12 rounded-md object-cover"
            onLoad={(e) =>
              setRatio(
                e.currentTarget.naturalHeight > 0
                  ? e.currentTarget.naturalWidth / e.currentTarget.naturalHeight
                  : null,
              )
            }
          />
        </a>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <StatusBadge status={post.status} />
            <span className="font-mono text-xs opacity-60">{post.dayId}</span>
          </div>
          <div className="text-sm font-medium">
            {formatTaipei(post.scheduledAt)} 台湾時間
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="neutral"
            className="btn-sm"
            disabled={busy}
            onClick={() => setPreviewOpen((v) => !v)}
          >
            プレビュー
          </Button>
          <Button
            variant="neutral"
            className="btn-sm"
            disabled={busy || editingTime}
            onClick={startTimeEdit}
          >
            日時変更
          </Button>
          <Button
            variant="neutral"
            className="btn-sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm("今すぐ Threads へ投稿しますか？")) {
                void onPublishNow(post.id);
              }
            }}
          >
            今すぐ投稿
          </Button>
          <Button
            variant="danger"
            className="btn-sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm("この予約を取り消しますか？")) {
                void onCancel(post.id);
              }
            }}
          >
            取消
          </Button>
        </div>
      </div>

      {post.status === "failed" && post.error && (
        <p className="m-0 mt-2 text-xs text-error">
          {post.error}（日時変更で再予約、または今すぐ投稿で再試行）
        </p>
      )}

      {editingTime && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs opacity-60">台湾時間</span>
          <input
            type="datetime-local"
            className="input input-sm input-bordered"
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
          />
          <Button
            variant="primary"
            className="btn-sm"
            disabled={busy}
            onClick={() => void saveTime()}
          >
            保存
          </Button>
          <Button
            variant="ghost"
            className="btn-sm"
            onClick={() => setEditingTime(false)}
          >
            キャンセル
          </Button>
          {timeError && <span className="text-xs text-error">{timeError}</span>}
        </div>
      )}

      {previewOpen && (
        <div className="mt-3 flex flex-col gap-2 rounded-md bg-base-200 p-3">
          <div className="flex items-center gap-2 text-xs opacity-60">
            投稿前プレビュー（先頭 40 字がフィードで目立つ部分）
            <AspectNote ratio={ratio} />
          </div>
          {text ? (
            <FeedPreview text={text} />
          ) : (
            <p className="m-0 text-sm text-error">
              本文 (passageZh) を取得できませんでした
            </p>
          )}
          <img
            src={`${post.imageUrl}?w=640&fm=webp`}
            alt=""
            className="max-h-72 w-auto max-w-full rounded-md"
          />
          <p className="m-0 text-xs opacity-60">
            ↳ リプライ: {DAY_URL_BASE}
            {post.dayId}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- ログ 1 行 ----

function LogRow({ post }: { post: PostItem }) {
  const text = post.postedText ?? post.passageZh ?? "";
  return (
    <div className="rounded-lg border border-base-300 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={`${DAY_URL_BASE}${post.dayId}`}
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={`${post.imageUrl}?w=120&fm=webp`}
            alt=""
            className="h-12 w-12 rounded-md object-cover"
          />
        </a>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            <span className="text-xs opacity-60">
              {post.publishedAt
                ? formatTaipei(post.publishedAt)
                : formatTaipei(post.scheduledAt)}{" "}
              台湾時間
            </span>
            <span className="font-mono text-xs opacity-40">{post.dayId}</span>
          </div>
          <p className="m-0 truncate text-sm opacity-80">{text.slice(0, 60)}</p>
          {post.error && (
            <p className="m-0 text-xs text-warning">{post.error}</p>
          )}
        </div>
        {post.threadsPermalink && (
          <a
            href={post.threadsPermalink}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm"
          >
            Threads で見る
          </a>
        )}
      </div>
    </div>
  );
}

// ---- 本体 ----

// refreshKey はタブを開き直すたびに増える (AdminTabs)。文章管理タブでの
// 新規予約をキューへ反映するため、変化したら一覧を再取得する。
export function ThreadsManager({ refreshKey = 0 }: { refreshKey?: number }) {
  const [status, setStatus] = useState<ConnStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualToken, setManualToken] = useState("");

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsState, setPostsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  const load = async (verify = false) => {
    setLoading(true);
    setError(null);
    const { data, error: actionError } = await actions.threadsStatus({
      verify,
    });
    if (actionError) {
      setError(actionError.message);
    } else {
      setStatus(data);
      if (verify && data.connected) {
        setNotice(
          data.tokenOk
            ? `トークンは有効です (@${data.username ?? data.threadsUserId})`
            : null,
        );
        if (data.tokenOk === false) {
          setError(
            "トークンが失効している可能性があります。再接続してください",
          );
        }
      }
    }
    setLoading(false);
  };

  const loadPosts = useCallback(async () => {
    setPostsState("loading");
    const { data, error: actionError } = await actions.threadsListPosts({});
    if (actionError || !data) {
      setPostsState("error");
      return;
    }
    setPosts(data.posts as PostItem[]);
    setPostsState("ready");
  }, []);

  useEffect(() => {
    // OAuth コールバックからの戻りクエリを拾って表示し、URL から消す。
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("threads") === "connected";
    const oauthError = params.get("threads_error");
    if (connected) setNotice("Threads と接続しました");
    if (oauthError) {
      setError(
        OAUTH_ERROR_MESSAGES[oauthError] ??
          `接続に失敗しました (${oauthError})`,
      );
    }
    if (connected || oauthError) {
      params.delete("threads");
      params.delete("threads_error");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        query ? `?${query}` : window.location.pathname,
      );
    }
    void load();
    void loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // タブを開き直したら (mount 済みのまま hidden が外れたら) 一覧を更新。
  useEffect(() => {
    if (refreshKey > 0) void loadPosts();
  }, [refreshKey, loadPosts]);

  const disconnect = async () => {
    if (
      !window.confirm(
        "Threads との接続を解除しますか？保存済みトークンを破棄します",
      )
    ) {
      return;
    }
    setBusy(true);
    const { error: actionError } = await actions.threadsDisconnect({});
    setBusy(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    setNotice("接続を解除しました");
    await load();
  };

  const submitManualToken = async () => {
    if (!manualToken.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error: actionError } = await actions.threadsSetToken({
      token: manualToken,
    });
    setBusy(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    setManualToken("");
    setNotice(`トークンを登録しました (@${data.username ?? "unknown"})`);
    await load();
  };

  // ---- キュー操作 ----

  const reschedule = async (id: number, iso: string) => {
    setBusy(true);
    const res = await actions.threadsReschedule({ id, scheduledAt: iso });
    setBusy(false);
    if (res.error) return res.error.message;
    await loadPosts();
    return null;
  };

  const cancel = async (id: number) => {
    setBusy(true);
    setError(null);
    const res = await actions.threadsCancel({ id });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setNotice("予約を取り消しました");
    await loadPosts();
  };

  const publishNow = async (id: number) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await actions.threadsPublishNow({ id });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
    } else {
      setNotice(
        res.data.replyFailed
          ? "投稿しました（URL リプライのみ失敗。ログを確認してください）"
          : "Threads へ投稿しました",
      );
    }
    await loadPosts();
  };

  const queue = posts
    .filter((p) => ["scheduled", "publishing", "failed"].includes(p.status))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const log = posts
    .filter((p) => ["published", "deleted"].includes(p.status))
    .sort((a, b) =>
      (b.publishedAt ?? b.scheduledAt).localeCompare(
        a.publishedAt ?? a.scheduledAt,
      ),
    );

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <div className="alert alert-success text-sm">
          <span>{notice}</span>
        </div>
      )}
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-base-content/70">
          Threads アカウント接続
        </h2>

        {loading && <span className="loading loading-spinner loading-sm" />}

        {!loading && status && !status.appConfigured && (
          <p className="text-sm text-base-content/70">
            THREADS_APP_ID / THREADS_APP_SECRET が未設定です。Meta アプリの
            作成とシークレット投入の手順は docs/threads.md を参照してください。
          </p>
        )}

        {!loading && status && !status.connected && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-base-content/70">
              未接続です。Threads アカウントを接続すると予約投稿を使えます。
            </p>
            {status.appConfigured && (
              <a
                className="btn btn-primary w-fit"
                href="/admin/threads/oauth/start"
              >
                Threads と接続
              </a>
            )}
          </div>
        )}

        {!loading && status?.connected && (
          <div className="flex flex-col gap-3">
            <div className="text-sm">
              <span className="font-semibold">
                @{status.username ?? status.threadsUserId}
              </span>{" "}
              として接続中
            </div>
            <div className="text-xs text-base-content/60">
              トークン期限: {formatDateTime(status.expiresAt)}（
              {formatDateTime(status.refreshedAt)} に更新 / 7日ごとに自動延長）
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy || loading}
                onClick={() => void load(true)}
              >
                接続確認
              </Button>
              <Button
                variant="danger"
                disabled={busy || loading}
                onClick={() => void disconnect()}
              >
                接続解除
              </Button>
            </div>
          </div>
        )}

        {!loading && status && !status.connected && status.appConfigured && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-base-content/60">
              長期トークンを手動登録（ローカル開発・応急用）
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                className="textarea textarea-bordered w-full font-mono text-xs"
                rows={3}
                placeholder="長期アクセストークンを貼り付け"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
              />
              <Button
                variant="outline"
                className="w-fit"
                disabled={busy || !manualToken.trim()}
                onClick={() => void submitManualToken()}
              >
                検証して保存
              </Button>
            </div>
          </details>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="m-0 text-sm font-semibold text-base-content/70">
            予約キュー
          </h2>
          <span className="text-xs opacity-50">
            台湾時間 20–22時 / 1日2件 / 60分以上間隔
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            className="btn-sm"
            disabled={postsState === "loading"}
            onClick={() => void loadPosts()}
          >
            再読込
          </Button>
        </div>

        {postsState === "error" ? (
          <div className="alert alert-error text-sm">
            <span>一覧の取得に失敗しました。</span>
            <Button
              variant="neutral"
              className="btn-sm"
              onClick={() => void loadPosts()}
            >
              再試行
            </Button>
          </div>
        ) : postsState === "loading" ? (
          <p className="m-0 py-4 text-center text-sm opacity-60">読み込み中…</p>
        ) : queue.length === 0 ? (
          <p className="m-0 py-4 text-sm opacity-60">
            予約はありません。文章管理タブの「Threads予約」から追加します。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {queue.map((post) => (
              <QueueRow
                key={post.id}
                post={post}
                busy={busy}
                onReschedule={reschedule}
                onCancel={cancel}
                onPublishNow={publishNow}
              />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-base-content/70">
          投稿ログ
        </h2>
        {postsState === "ready" && log.length === 0 ? (
          <p className="m-0 py-2 text-sm opacity-60">まだ投稿はありません。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {log.map((post) => (
              <LogRow key={post.id} post={post} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default ThreadsManager;
