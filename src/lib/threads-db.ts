import { env as rawEnv } from "cloudflare:workers";

// Threads 連携の D1 (THREADS_DB binding) アクセス層。予約キュー・投稿ログ・
// 長期トークンを保持する。スキーマは migrations/0001_threads.sql。
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

// ---- 認証 (threads_auth, 常に 1 行) ----

export type ThreadsAuth = {
  accessToken: string;
  threadsUserId: string;
  username: string | null;
  expiresAt: string;
  refreshedAt: string;
};

type ThreadsAuthRow = {
  access_token: string;
  threads_user_id: string;
  username: string | null;
  expires_at: string;
  refreshed_at: string;
};

export async function getThreadsAuth(): Promise<ThreadsAuth | null> {
  const row = await getThreadsDb()
    .prepare("SELECT * FROM threads_auth WHERE id = 1")
    .first<ThreadsAuthRow>();
  if (!row) return null;
  return {
    accessToken: row.access_token,
    threadsUserId: row.threads_user_id,
    username: row.username,
    expiresAt: row.expires_at,
    refreshedAt: row.refreshed_at,
  };
}

export async function saveThreadsAuth(auth: ThreadsAuth): Promise<void> {
  await getThreadsDb()
    .prepare(
      `INSERT INTO threads_auth
         (id, access_token, threads_user_id, username, expires_at, refreshed_at)
       VALUES (1, ?1, ?2, ?3, ?4, ?5)
       ON CONFLICT (id) DO UPDATE SET
         access_token = ?1, threads_user_id = ?2, username = ?3,
         expires_at = ?4, refreshed_at = ?5`,
    )
    .bind(
      auth.accessToken,
      auth.threadsUserId,
      auth.username,
      auth.expiresAt,
      auth.refreshedAt,
    )
    .run();
}

export async function deleteThreadsAuth(): Promise<void> {
  await getThreadsDb().prepare("DELETE FROM threads_auth WHERE id = 1").run();
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
  channel: string;
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
};

type ThreadsPostRow = {
  id: number;
  channel: string;
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
export async function listActiveThreadsScheduleTimes(): Promise<string[]> {
  const res = await getThreadsDb()
    .prepare(
      "SELECT scheduled_at FROM threads_posts WHERE status IN ('scheduled','publishing')",
    )
    .all<{ scheduled_at: string }>();
  return res.results.map((r) => r.scheduled_at);
}

// 同じ写真の二重予約を防ぐためのチェック。
export async function findActiveThreadsPostByDay(
  dayId: string,
): Promise<ThreadsPost | null> {
  const row = await getThreadsDb()
    .prepare(
      "SELECT * FROM threads_posts WHERE day_id = ?1 AND status IN ('scheduled','publishing') LIMIT 1",
    )
    .bind(dayId)
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
  imageUrl: string;
  scheduledAt: string;
}): Promise<ThreadsPost> {
  const row = await getThreadsDb()
    .prepare(
      `INSERT INTO threads_posts (day_id, image_url, scheduled_at, created_at)
       VALUES (?1, ?2, ?3, ?4) RETURNING *`,
    )
    .bind(
      input.dayId,
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

// Threads 側から削除済みにする。行は履歴として残す (status='deleted')。
export async function markThreadsPostDeleted(id: number): Promise<void> {
  await getThreadsDb()
    .prepare(
      "UPDATE threads_posts SET status = 'deleted' WHERE id = ?1 AND status = 'published'",
    )
    .bind(id)
    .run();
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
