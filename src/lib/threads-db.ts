import { env as rawEnv } from "cloudflare:workers";

import type { ThreadsChannel } from "@/lib/threads-channels";

// Threads 連携の D1 (THREADS_DB binding) アクセス層。予約キュー・投稿ログ・
// チャンネル別の長期トークンを保持する。スキーマは migrations/ 配下。
// D1 binding は lib/env.ts の zod スキーマ (文字列 env 用) を通らないため、
// ここで cloudflare:workers の env から直接取り出す。

export function getThreadsDb(): D1Database {
  const db = (rawEnv as unknown as Env).THREADS_DB;
  if (!db) {
    throw new Error(
      "THREADS_DB (D1) binding がありません。wrangler.jsonc と docs/threads.md を確認してください",
    );
  }
  return db;
}

// ---- 認証 (threads_accounts, チャンネルごとに 1 行) ----

export type ThreadsAccount = {
  channel: ThreadsChannel;
  accessToken: string;
  threadsUserId: string;
  username: string | null;
  expiresAt: string;
  refreshedAt: string;
};

type ThreadsAccountRow = {
  channel: ThreadsChannel;
  access_token: string;
  threads_user_id: string;
  username: string | null;
  expires_at: string;
  refreshed_at: string;
};

function toAccount(row: ThreadsAccountRow): ThreadsAccount {
  return {
    channel: row.channel,
    accessToken: row.access_token,
    threadsUserId: row.threads_user_id,
    username: row.username,
    expiresAt: row.expires_at,
    refreshedAt: row.refreshed_at,
  };
}

export async function getThreadsAccount(
  channel: ThreadsChannel,
): Promise<ThreadsAccount | null> {
  const row = await getThreadsDb()
    .prepare("SELECT * FROM threads_accounts WHERE channel = ?1")
    .bind(channel)
    .first<ThreadsAccountRow>();
  return row ? toAccount(row) : null;
}

export async function listThreadsAccounts(): Promise<ThreadsAccount[]> {
  const res = await getThreadsDb()
    .prepare("SELECT * FROM threads_accounts")
    .all<ThreadsAccountRow>();
  return res.results.map(toAccount);
}

export async function saveThreadsAccount(
  account: ThreadsAccount,
): Promise<void> {
  await getThreadsDb()
    .prepare(
      `INSERT INTO threads_accounts
         (channel, access_token, threads_user_id, username, expires_at, refreshed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (channel) DO UPDATE SET
         access_token = ?2, threads_user_id = ?3, username = ?4,
         expires_at = ?5, refreshed_at = ?6`,
    )
    .bind(
      account.channel,
      account.accessToken,
      account.threadsUserId,
      account.username,
      account.expiresAt,
      account.refreshedAt,
    )
    .run();
}

export async function deleteThreadsAccount(
  channel: ThreadsChannel,
): Promise<void> {
  await getThreadsDb()
    .prepare("DELETE FROM threads_accounts WHERE channel = ?1")
    .bind(channel)
    .run();
}

// ---- 予約キュー / 投稿ログ (threads_posts) ----
//
// 状態遷移: scheduled → publishing → published | failed
//   - failed は日時再設定で scheduled に戻せる (リトライ)
//   - scheduled / failed の取消は行削除 (ログに残さない)
//   - published の削除 (Threads 側も消す) は deleted (履歴として残す)

export type ThreadsPostStatus =
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "deleted";

export type ThreadsPost = {
  id: number;
  channel: ThreadsChannel;
  dayId: string;
  imageUrl: string;
  scheduledAt: string;
  status: ThreadsPostStatus;
  postedText: string | null;
  threadsMediaId: string | null;
  threadsPermalink: string | null;
  replyMediaId: string | null;
  error: string | null;
  createdAt: string;
  publishedAt: string | null;
  // 返信状況のキャッシュ (cron が同期。migrations/0002 参照)。
  replyCount: number;
  needsReply: boolean;
  replySyncedAt: string | null;
};

type ThreadsPostRow = {
  id: number;
  // migration 0003 適用後は threads-zh / threads-ja のどちらか。
  channel: ThreadsChannel;
  day_id: string;
  image_url: string;
  scheduled_at: string;
  status: ThreadsPostStatus;
  posted_text: string | null;
  threads_media_id: string | null;
  threads_permalink: string | null;
  reply_media_id: string | null;
  error: string | null;
  created_at: string;
  published_at: string | null;
  reply_count: number;
  needs_reply: number;
  reply_synced_at: string | null;
};

function toPost(row: ThreadsPostRow): ThreadsPost {
  return {
    id: row.id,
    channel: row.channel,
    dayId: row.day_id,
    imageUrl: row.image_url,
    scheduledAt: row.scheduled_at,
    status: row.status,
    postedText: row.posted_text,
    threadsMediaId: row.threads_media_id,
    threadsPermalink: row.threads_permalink,
    replyMediaId: row.reply_media_id,
    error: row.error,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    replyCount: row.reply_count ?? 0,
    needsReply: row.needs_reply === 1,
    replySyncedAt: row.reply_synced_at,
  };
}

// 全件 (予約 + ログ)。ダッシュボードで使う。個人運用でデータ量は小さい
// 前提なので上限だけ設けてページングはしない。
export async function listThreadsPosts(limit = 200): Promise<ThreadsPost[]> {
  const res = await getThreadsDb()
    .prepare("SELECT * FROM threads_posts ORDER BY scheduled_at DESC LIMIT ?1")
    .bind(limit)
    .all<ThreadsPostRow>();
  return res.results.map(toPost);
}

// 枠割当の入力になる「アクティブな予約」(scheduled / publishing) の時刻一覧。
// 2 チャンネルは同じ時刻に対で積まれるので DISTINCT で 1 つに畳む
// (1日2件・60分間隔の枠ルールはアカウントごとの体感频度に対するもの)。
export async function listActiveThreadsScheduleTimes(): Promise<string[]> {
  const res = await getThreadsDb()
    .prepare(
      "SELECT DISTINCT scheduled_at FROM threads_posts WHERE status IN ('scheduled','publishing')",
    )
    .all<{ scheduled_at: string }>();
  return res.results.map((r) => r.scheduled_at);
}

// 同じ写真の二重予約を防ぐためのチェック (チャンネルごと)。
export async function findActiveThreadsPostByDay(
  dayId: string,
  channel: ThreadsChannel,
): Promise<ThreadsPost | null> {
  const row = await getThreadsDb()
    .prepare(
      "SELECT * FROM threads_posts WHERE day_id = ?1 AND channel = ?2 AND status IN ('scheduled','publishing') LIMIT 1",
    )
    .bind(dayId, channel)
    .first<ThreadsPostRow>();
  return row ? toPost(row) : null;
}

// 文章管理タブのバッジ用。表示中ページの day_id 群の予約状況をまとめて引く。
export async function listThreadsPostsByDayIds(
  dayIds: readonly string[],
): Promise<ThreadsPost[]> {
  if (dayIds.length === 0) return [];
  const placeholders = dayIds.map((_, i) => `?${i + 1}`).join(",");
  const res = await getThreadsDb()
    .prepare(
      `SELECT * FROM threads_posts WHERE day_id IN (${placeholders})
       ORDER BY created_at DESC`,
    )
    .bind(...dayIds)
    .all<ThreadsPostRow>();
  return res.results.map(toPost);
}

export async function getThreadsPost(id: number): Promise<ThreadsPost | null> {
  const row = await getThreadsDb()
    .prepare("SELECT * FROM threads_posts WHERE id = ?1")
    .bind(id)
    .first<ThreadsPostRow>();
  return row ? toPost(row) : null;
}

export async function insertThreadsPost(input: {
  dayId: string;
  channel: ThreadsChannel;
  imageUrl: string;
  scheduledAt: string;
}): Promise<ThreadsPost> {
  const row = await getThreadsDb()
    .prepare(
      `INSERT INTO threads_posts (day_id, channel, image_url, scheduled_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5) RETURNING *`,
    )
    .bind(
      input.dayId,
      input.channel,
      input.imageUrl,
      input.scheduledAt,
      new Date().toISOString(),
    )
    .first<ThreadsPostRow>();
  if (!row) throw new Error("threads_posts insert failed");
  return toPost(row);
}

// 日時変更。failed からの再設定も兼ねる (status を scheduled に戻し
// error をクリア)。対象が既に publishing / published なら null。
export async function rescheduleThreadsPost(
  id: number,
  scheduledAt: string,
): Promise<ThreadsPost | null> {
  const row = await getThreadsDb()
    .prepare(
      `UPDATE threads_posts
       SET scheduled_at = ?2, status = 'scheduled', error = NULL
       WHERE id = ?1 AND status IN ('scheduled','failed') RETURNING *`,
    )
    .bind(id, scheduledAt)
    .first<ThreadsPostRow>();
  return row ? toPost(row) : null;
}

// 未投稿予約の取消 = 行削除。消せたら true。
export async function deleteScheduledThreadsPost(id: number): Promise<boolean> {
  const res = await getThreadsDb()
    .prepare(
      "DELETE FROM threads_posts WHERE id = ?1 AND status IN ('scheduled','failed')",
    )
    .bind(id)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

// 「今すぐ投稿」用の単発 claim。二重実行防止のため状態遷移を条件に含める。
export async function claimThreadsPost(
  id: number,
): Promise<ThreadsPost | null> {
  const row = await getThreadsDb()
    .prepare(
      `UPDATE threads_posts SET status = 'publishing'
       WHERE id = ?1 AND status IN ('scheduled','failed') RETURNING *`,
    )
    .bind(id)
    .first<ThreadsPostRow>();
  return row ? toPost(row) : null;
}

// cron 用: 予定時刻が来た予約をまとめて claim する。UPDATE ... RETURNING が
// アトミックなので、cron の実行が重なっても同じ行を二度 publish しない。
export async function claimDueThreadsPosts(
  nowIso: string,
): Promise<ThreadsPost[]> {
  const res = await getThreadsDb()
    .prepare(
      `UPDATE threads_posts SET status = 'publishing'
       WHERE status = 'scheduled' AND scheduled_at <= ?1 RETURNING *`,
    )
    .bind(nowIso)
    .all<ThreadsPostRow>();
  return res.results.map(toPost);
}

// publish 成功。error にはリプライ (URL ぶら下げ) だけ失敗したときの
// メッセージが入ることがある (本体は成功扱い、ダッシュボードに注記)。
export async function markThreadsPostPublished(
  id: number,
  result: {
    postedText: string;
    threadsMediaId: string;
    threadsPermalink: string | null;
    replyMediaId: string | null;
    error: string | null;
  },
): Promise<void> {
  await getThreadsDb()
    .prepare(
      `UPDATE threads_posts
       SET status = 'published', posted_text = ?2, threads_media_id = ?3,
           threads_permalink = ?4, reply_media_id = ?5, error = ?6,
           published_at = ?7
       WHERE id = ?1`,
    )
    .bind(
      id,
      result.postedText,
      result.threadsMediaId,
      result.threadsPermalink,
      result.replyMediaId,
      result.error,
      new Date().toISOString(),
    )
    .run();
}

// ---- 返信状況のキャッシュ ----

// cron が同期する対象。同期が古い順 (未同期が先頭) に少しずつ回すことで、
// 1 回あたりの Threads API 呼び出し数を上限で抑えつつ全件を巡回できる。
// 返信が付く見込みのない古い投稿は対象外にする。
export async function listPostsForReplySync(
  limit: number,
  publishedAfterIso: string,
): Promise<ThreadsPost[]> {
  const res = await getThreadsDb()
    .prepare(
      `SELECT * FROM threads_posts
       WHERE status = 'published' AND threads_media_id IS NOT NULL
         AND published_at >= ?2
       ORDER BY reply_synced_at IS NOT NULL, reply_synced_at ASC
       LIMIT ?1`,
    )
    .bind(limit, publishedAfterIso)
    .all<ThreadsPostRow>();
  return res.results.map(toPost);
}

export async function updateThreadsReplyStats(
  id: number,
  stats: { replyCount: number; needsReply: boolean },
): Promise<void> {
  await getThreadsDb()
    .prepare(
      `UPDATE threads_posts
       SET reply_count = ?2, needs_reply = ?3, reply_synced_at = ?4
       WHERE id = ?1`,
    )
    .bind(
      id,
      stats.replyCount,
      stats.needsReply ? 1 : 0,
      new Date().toISOString(),
    )
    .run();
}

// admin のタブバッジ用。未返信の投稿件数だけを D1 から数える
// (Threads API は叩かないので admin を開くたびに呼んでも安い)。
export async function countThreadsPostsNeedingReply(): Promise<number> {
  const row = await getThreadsDb()
    .prepare(
      "SELECT COUNT(*) AS n FROM threads_posts WHERE status = 'published' AND needs_reply = 1",
    )
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// Threads 側から削除済みにする。行は履歴として残す (status='deleted')。
export async function markThreadsPostDeleted(id: number): Promise<void> {
  await getThreadsDb()
    .prepare(
      "UPDATE threads_posts SET status = 'deleted' WHERE id = ?1 AND status = 'published'",
    )
    .bind(id)
    .run();
}

// 削除済み行を履歴からも消す (完全削除)。対象は status='deleted' のみ。
// published をここで直接消させない (Threads 側の削除を伴う操作は
// threadsDeletePost 経由で、まず 'deleted' にする)。
export async function purgeDeletedThreadsPost(id: number): Promise<boolean> {
  const res = await getThreadsDb()
    .prepare("DELETE FROM threads_posts WHERE id = ?1 AND status = 'deleted'")
    .bind(id)
    .run();
  return (res.meta.changes ?? 0) > 0;
}

export async function markThreadsPostFailed(
  id: number,
  error: string,
): Promise<void> {
  await getThreadsDb()
    .prepare(
      "UPDATE threads_posts SET status = 'failed', error = ?2 WHERE id = ?1",
    )
    .bind(id, error.slice(0, 500))
    .run();
}
