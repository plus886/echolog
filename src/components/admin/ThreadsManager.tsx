import { actions } from "astro:actions";
import { useCallback, useEffect, useState } from "react";

import { Button, Card, ErrorAlert } from "@/components/admin/ui";
import {
  formatTaipei,
  isoToTaipeiInput,
  taipeiInputToIso,
} from "@/lib/taipei-time";
import {
  CHANNEL_LABEL,
  dayPageUrl,
  isThreadsChannel,
  THREADS_CHANNELS,
  type ThreadsChannel,
} from "@/lib/threads-channels";

// Threads タブ = 接続管理 + 予約投稿ダッシュボード。チャンネル (言語別
// アカウント: 中文 threads-zh / 日本語 threads-ja) ごとに接続を持ち、
// 予約は 1 操作で両チャンネルに積まれる (文章管理タブ)。キュー・ログの
// 行はチャンネル単位で、日時変更・取消・返信・削除も行ごとに行う。
//  - 予約キュー: 予約中 / 実行中 / 失敗 (時系列昇順)。日時編集・取消・
//    今すぐ投稿・投稿前プレビュー (先頭40字のフィード見え方 + 画像縦横比)。
//  - 投稿ログ: 投稿済み / 削除済み (新しい順)。permalink・失敗注記に加え、
//    行を開くと表示回数と届いた返信を取得し、その場で返信できる。削除は
//    Threads 側のポスト (と URL リプライ) も消す。
//
// 接続フロー: チャンネルの「接続」→ /admin/threads/oauth/start?channel=…
// → Meta の認可画面 → callback が D1 にトークンを保存 →
// /admin?threads=connected&channel=… に戻る。mount 時にそのクエリを拾って
// 結果を表示し、URL からは消す。

type AccountInfo = {
  username: string | null;
  threadsUserId: string;
  expiresAt: string;
  refreshedAt: string;
  tokenOk?: boolean;
};

type ConnStatus = {
  appConfigured: boolean;
  accounts: Record<ThreadsChannel, AccountInfo | null>;
};

type PostItem = {
  id: number;
  channel: ThreadsChannel;
  dayId: string;
  imageUrl: string;
  scheduledAt: string;
  status: "scheduled" | "publishing" | "published" | "failed" | "deleted";
  postedText: string | null;
  threadsPermalink: string | null;
  error: string | null;
  publishedAt: string | null;
  // 行のチャンネルに対応する現時点の本文 (zh は passageZh、ja は passageJa)。
  passage: string | null;
  // cron が同期した返信状況 (開かなくても分かるようバッジに出す)。
  replyCount: number;
  needsReply: boolean;
  replySyncedAt: string | null;
};

type ReplyItem = {
  id: string;
  text: string;
  username: string | null;
  permalink: string | null;
  timestamp: string | null;
  isReplyOwnedByMe: boolean;
};

// 投稿済み 1 件の追加情報 (返信・表示回数)。行を開いたときだけ取得する
// (ログ全件ぶんの API 呼び出しを避けるため)。
type PostDetail = {
  loading: boolean;
  views?: number | null;
  replies?: ReplyItem[];
  error?: string | null;
};

const EMPTY_DETAIL: PostDetail = { loading: false };

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: "認可がキャンセルされました",
  state: "state の検証に失敗しました。もう一度お試しください",
  exchange: "トークンの取得に失敗しました。サーバログを確認してください",
  same_account:
    "もう一方のチャンネルと同じアカウントが認可されました。Threads 側でログイン中のアカウントを切り替えてから再接続してください",
};

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

// チャンネル (言語別アカウント) の識別バッジ。
function ChannelBadge({ channel }: { channel: ThreadsChannel }) {
  return (
    <span className="badge badge-outline badge-sm whitespace-nowrap">
      {CHANNEL_LABEL[channel]}
    </span>
  );
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

  const text = post.passage ?? post.postedText ?? "";

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
          href={dayPageUrl(post.channel, post.dayId)}
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
            <ChannelBadge channel={post.channel} />
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
              本文 ({post.channel === "threads-zh" ? "passageZh" : "passageJa"})
              を取得できませんでした
            </p>
          )}
          <img
            src={`${post.imageUrl}?w=640&fm=webp`}
            alt=""
            className="max-h-72 w-auto max-w-full rounded-md"
          />
          <p className="m-0 text-xs opacity-60">
            ↳ リプライ: {dayPageUrl(post.channel, post.dayId)}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- ログ 1 行 ----

function LogRow({
  post,
  busy,
  detail,
  onOpenDetail,
  onReply,
  onDelete,
}: {
  post: PostItem;
  busy: boolean;
  detail: PostDetail;
  onOpenDetail: (id: number) => Promise<void>;
  onReply: (
    postId: number,
    replyToId: string,
    text: string,
  ) => Promise<string | null>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const text = post.postedText ?? post.passage ?? "";
  return (
    <div className="rounded-lg border border-base-300 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={dayPageUrl(post.channel, post.dayId)}
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
            <ChannelBadge channel={post.channel} />
            {/* 返信の見落とし防止。未返信は目立たせ、返信済みは件数だけ。 */}
            {post.needsReply ? (
              <span className="badge badge-warning badge-sm font-semibold">
                要返信 {post.replyCount}
              </span>
            ) : (
              post.replyCount > 0 && (
                <span className="badge badge-ghost badge-sm">
                  返信 {post.replyCount}
                </span>
              )
            )}
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
          {post.replySyncedAt === null && post.status === "published" && (
            <p className="m-0 text-xs opacity-40">返信の確認待ち</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {post.status === "published" && (
            <>
              <Button
                variant="neutral"
                className="btn-sm"
                disabled={detail.loading}
                onClick={() => {
                  if (!open) void onOpenDetail(post.id);
                  setOpen((v) => !v);
                }}
              >
                {detail.loading
                  ? "取得中…"
                  : open
                    ? "閉じる"
                    : "返信・表示回数"}
              </Button>
              <Button
                variant="danger"
                className="btn-sm"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "この投稿を Threads からも削除します。取り消せません。よろしいですか？",
                    )
                  ) {
                    void onDelete(post.id);
                  }
                }}
              >
                削除
              </Button>
            </>
          )}
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

      {open && (
        <div className="mt-3 flex flex-col gap-2 rounded-md bg-base-200 p-3">
          <div className="flex items-center gap-3 text-xs">
            <span className="opacity-60">
              表示回数:{" "}
              {detail.views === null || detail.views === undefined ? (
                <span className="opacity-60">取得できません</span>
              ) : (
                <span className="font-semibold">
                  {detail.views.toLocaleString("ja-JP")}
                </span>
              )}
            </span>
            <span className="opacity-60">
              返信: {detail.replies?.length ?? 0} 件
            </span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              className="btn-xs"
              disabled={detail.loading}
              onClick={() => void onOpenDetail(post.id)}
            >
              更新
            </Button>
          </div>

          {detail.error && (
            <p className="m-0 text-xs text-error">{detail.error}</p>
          )}

          {detail.replies?.length === 0 && !detail.loading && (
            <p className="m-0 text-sm opacity-60">まだ返信はありません。</p>
          )}

          {detail.replies?.map((reply) => (
            <ReplyRow
              key={reply.id}
              postId={post.id}
              channel={post.channel}
              reply={reply}
              busy={busy}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- 届いた返信 1 件 + 返信フォーム ----

function ReplyRow({
  postId,
  channel,
  reply,
  busy,
  onReply,
}: {
  postId: number;
  channel: ThreadsChannel;
  reply: ReplyItem;
  busy: boolean;
  onReply: (
    postId: number,
    replyToId: string,
    text: string,
  ) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    const message = await onReply(postId, reply.id, text);
    setSending(false);
    if (message) {
      setError(message);
      return;
    }
    setText("");
    setOpen(false);
    setSent(true);
  };

  return (
    <div
      className={`rounded-md bg-base-100 p-2 ${
        reply.isReplyOwnedByMe ? "border-l-4 border-primary/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs opacity-60">
        <span className="font-semibold">@{reply.username ?? "unknown"}</span>
        {reply.isReplyOwnedByMe && (
          <span className="badge badge-ghost badge-xs">自分</span>
        )}
        {reply.timestamp && (
          <span>{formatTaipei(reply.timestamp)} 台湾時間</span>
        )}
        {reply.permalink && (
          <a
            href={reply.permalink}
            target="_blank"
            rel="noreferrer"
            className="link"
          >
            開く
          </a>
        )}
        <div className="flex-1" />
        {sent && <span className="text-success">返信しました</span>}
        <Button
          variant="ghost"
          className="btn-xs"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "やめる" : "返信"}
        </Button>
      </div>
      <p className="m-0 mt-1 text-sm whitespace-pre-wrap">{reply.text}</p>

      {open && (
        <div className="mt-2 flex flex-col gap-1.5">
          <textarea
            className="textarea textarea-bordered w-full text-sm"
            rows={2}
            maxLength={500}
            placeholder={
              channel === "threads-zh"
                ? "返信を入力（繁體中文）"
                : "返信を入力（日本語）"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          {error && <p className="m-0 text-xs text-error">{error}</p>}
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-50">{text.length} / 500</span>
            <div className="flex-1" />
            <Button
              variant="primary"
              className="btn-sm"
              disabled={sending || !text.trim()}
              onClick={() => void send()}
            >
              {sending ? "送信中…" : "送信"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 本体 ----

// refreshKey はタブを開き直すたびに増える (AdminTabs)。文章管理タブでの
// 新規予約をキューへ反映するため、変化したら一覧を再取得する。
// onRepliesChanged は返信状況が変わったときの通知 (タブの未返信バッジ用)。
export function ThreadsManager({
  refreshKey = 0,
  onRepliesChanged,
}: {
  refreshKey?: number;
  onRepliesChanged?: () => void;
}) {
  const [status, setStatus] = useState<ConnStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualTokens, setManualTokens] = useState<
    Record<ThreadsChannel, string>
  >({ "threads-zh": "", "threads-ja": "" });

  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsState, setPostsState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  // 投稿済み行を開いたときだけ取得する返信・表示回数 (post.id → 詳細)。
  const [details, setDetails] = useState<Record<number, PostDetail>>({});

  const load = async (verify = false) => {
    setLoading(true);
    setError(null);
    const { data, error: actionError } = await actions.threadsStatus({
      verify,
    });
    if (actionError) {
      setError(actionError.message);
    } else {
      setStatus(data as ConnStatus);
      if (verify) {
        // 各チャンネルの生存確認の結果をまとめて出す。
        const results = THREADS_CHANNELS.flatMap((channel) => {
          const account = (data as ConnStatus).accounts[channel];
          if (!account || account.tokenOk === undefined) return [];
          return [
            `${CHANNEL_LABEL[channel]}: ${
              account.tokenOk
                ? `有効 (@${account.username ?? account.threadsUserId})`
                : "失効の可能性"
            }`,
          ];
        });
        setNotice(
          results.length > 0 ? `トークン確認 — ${results.join(" / ")}` : null,
        );
        const anyExpired = THREADS_CHANNELS.some(
          (channel) =>
            (data as ConnStatus).accounts[channel]?.tokenOk === false,
        );
        if (anyExpired) {
          setError(
            "失効している可能性のあるトークンがあります。該当チャンネルを再接続してください",
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
    onRepliesChanged?.();
  }, [onRepliesChanged]);

  useEffect(() => {
    // OAuth コールバックからの戻りクエリを拾って表示し、URL から消す。
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("threads") === "connected";
    const oauthError = params.get("threads_error");
    const channelParam = params.get("channel");
    if (connected) {
      const label = isThreadsChannel(channelParam)
        ? `（${CHANNEL_LABEL[channelParam]}）`
        : "";
      setNotice(`Threads と接続しました${label}`);
    }
    if (oauthError) {
      setError(
        OAUTH_ERROR_MESSAGES[oauthError] ??
          `接続に失敗しました (${oauthError})`,
      );
    }
    if (connected || oauthError) {
      params.delete("threads");
      params.delete("threads_error");
      params.delete("channel");
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

  const disconnect = async (channel: ThreadsChannel) => {
    if (
      !window.confirm(
        `${CHANNEL_LABEL[channel]}アカウントの接続を解除しますか？保存済みトークンを破棄します`,
      )
    ) {
      return;
    }
    setBusy(true);
    const { error: actionError } = await actions.threadsDisconnect({ channel });
    setBusy(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    setNotice(`${CHANNEL_LABEL[channel]}アカウントの接続を解除しました`);
    await load();
  };

  const submitManualToken = async (channel: ThreadsChannel) => {
    const token = manualTokens[channel];
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error: actionError } = await actions.threadsSetToken({
      channel,
      token,
    });
    setBusy(false);
    if (actionError) {
      setError(actionError.message);
      return;
    }
    setManualTokens((m) => ({ ...m, [channel]: "" }));
    setNotice(
      `${CHANNEL_LABEL[channel]}のトークンを登録しました (@${data.username ?? "unknown"})`,
    );
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

  // ---- 公開後の操作 ----

  const openDetail = async (id: number) => {
    setDetails((d) => ({
      ...d,
      [id]: { ...(d[id] ?? EMPTY_DETAIL), loading: true },
    }));
    const res = await actions.threadsPostDetail({ id });
    setDetails((d) => ({
      ...d,
      [id]: res.error
        ? {
            ...(d[id] ?? EMPTY_DETAIL),
            loading: false,
            error: res.error.message,
          }
        : {
            loading: false,
            error: null,
            views: res.data.views,
            replies: res.data.replies as ReplyItem[],
          },
    }));
    // 開いた時点の実データで行のバッジも更新する (cron を待たない)。
    if (!res.error) {
      const stats = res.data.stats;
      setPosts((list) =>
        list.map((p) =>
          p.id === id
            ? {
                ...p,
                replyCount: stats.replyCount,
                needsReply: stats.needsReply,
                replySyncedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
      onRepliesChanged?.();
    }
  };

  const replyTo = async (postId: number, replyToId: string, text: string) => {
    setBusy(true);
    const res = await actions.threadsReplyTo({ id: postId, replyToId, text });
    setBusy(false);
    if (res.error) return res.error.message;
    // 送信した返信を一覧へ反映する。
    await openDetail(postId);
    return null;
  };

  const deletePost = async (id: number) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await actions.threadsDeletePost({ id });
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setNotice("Threads から削除しました");
    await loadPosts();
  };

  // 2 チャンネルの対は同時刻なので、時刻同順はチャンネルで安定させる
  // (接続カードと同じく中文 threads-zh を先に)。
  const queue = posts
    .filter((p) => ["scheduled", "publishing", "failed"].includes(p.status))
    .sort(
      (a, b) =>
        a.scheduledAt.localeCompare(b.scheduledAt) ||
        b.channel.localeCompare(a.channel),
    );
  // ログは新しい順。ただし未返信のものは見落とさないよう先頭へ寄せる。
  const log = posts
    .filter((p) => ["published", "deleted"].includes(p.status))
    .sort((a, b) => {
      if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
      return (b.publishedAt ?? b.scheduledAt).localeCompare(
        a.publishedAt ?? a.scheduledAt,
      );
    });
  const needsReplyCount = log.filter((p) => p.needsReply).length;

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

        {!loading && status && (
          <div className="flex flex-col gap-3">
            {THREADS_CHANNELS.map((channel) => {
              const account = status.accounts[channel];
              return (
                <div
                  key={channel}
                  className="rounded-md border border-base-300 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <ChannelBadge channel={channel} />
                    <span className="text-xs opacity-50">
                      {channel === "threads-zh"
                        ? "中文詩 (passageZh) を投稿"
                        : "日本語短歌 (passageJa) を投稿"}
                    </span>
                  </div>

                  {account ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-sm">
                        <span className="font-semibold">
                          @{account.username ?? account.threadsUserId}
                        </span>{" "}
                        として接続中
                        {account.tokenOk === false && (
                          <span className="ml-2 text-xs text-error">
                            トークン失効の可能性
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-base-content/60">
                        トークン期限: {formatDateTime(account.expiresAt)}（
                        {formatDateTime(account.refreshedAt)} に更新 /
                        7日ごとに自動延長）
                      </div>
                      <Button
                        variant="danger"
                        className="btn-sm w-fit"
                        disabled={busy || loading}
                        onClick={() => void disconnect(channel)}
                      >
                        接続解除
                      </Button>
                    </div>
                  ) : status.appConfigured ? (
                    <div className="flex flex-col gap-2">
                      <p className="m-0 text-sm text-base-content/70">
                        未接続です。Threads
                        側でこのチャンネル用のアカウントにログインした状態で接続してください。
                      </p>
                      <a
                        className="btn btn-primary btn-sm w-fit"
                        href={`/admin/threads/oauth/start?channel=${channel}`}
                      >
                        {CHANNEL_LABEL[channel]}アカウントと接続
                      </a>
                      <details>
                        <summary className="cursor-pointer text-xs text-base-content/60">
                          長期トークンを手動登録（ローカル開発・応急用）
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                          <textarea
                            className="textarea textarea-bordered w-full font-mono text-xs"
                            rows={3}
                            placeholder="長期アクセストークンを貼り付け"
                            value={manualTokens[channel]}
                            onChange={(e) =>
                              setManualTokens((m) => ({
                                ...m,
                                [channel]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            variant="outline"
                            className="btn-sm w-fit"
                            disabled={busy || !manualTokens[channel].trim()}
                            onClick={() => void submitManualToken(channel)}
                          >
                            検証して保存
                          </Button>
                        </div>
                      </details>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {status.appConfigured &&
              Object.values(status.accounts).some(Boolean) && (
                <Button
                  variant="outline"
                  className="btn-sm w-fit"
                  disabled={busy || loading}
                  onClick={() => void load(true)}
                >
                  接続確認
                </Button>
              )}
          </div>
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-sm font-semibold text-base-content/70">
            投稿ログ
          </h2>
          {needsReplyCount > 0 ? (
            <span className="badge badge-warning badge-sm font-semibold">
              未返信 {needsReplyCount} 件
            </span>
          ) : (
            postsState === "ready" &&
            log.length > 0 && (
              <span className="text-xs opacity-50">未返信はありません</span>
            )
          )}
          <span className="text-xs opacity-40">
            返信は 5 分毎に自動確認されます
          </span>
        </div>
        {postsState === "ready" && log.length === 0 ? (
          <p className="m-0 py-2 text-sm opacity-60">まだ投稿はありません。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {log.map((post) => (
              <LogRow
                key={post.id}
                post={post}
                busy={busy}
                detail={details[post.id] ?? EMPTY_DETAIL}
                onOpenDetail={openDetail}
                onReply={replyTo}
                onDelete={deletePost}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default ThreadsManager;
