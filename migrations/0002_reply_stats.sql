-- 返信の見落としを防ぐため、投稿ごとの返信状況を D1 にキャッシュする。
-- Threads API には「自分の全投稿への返信」をまとめて取る口が無く、投稿
-- 1 件ごとに conversation を引く必要があるので、画面表示のたびに叩くと
-- 高くつく。cron が少しずつ同期し、管理画面は D1 を読むだけにする。
--
-- needs_reply: 最新の返信が自分以外のもの = まだ返していない、の意。
-- reply_synced_at: 同期のローテーション順を決めるためのカーソル。
ALTER TABLE threads_posts ADD COLUMN reply_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE threads_posts ADD COLUMN needs_reply INTEGER NOT NULL DEFAULT 0;
ALTER TABLE threads_posts ADD COLUMN reply_synced_at TEXT;

CREATE INDEX idx_threads_posts_reply_sync
  ON threads_posts (status, reply_synced_at);
