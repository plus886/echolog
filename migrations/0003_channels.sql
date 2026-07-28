-- 日本語短歌 (passageJa) を別の Threads アカウントへも流すため、
-- 認証を「常に 1 行の threads_auth」からチャンネル別の threads_accounts に
-- 改める。チャンネルは threads-zh (中文・既存アカウント) / threads-ja
-- (日本語・新規アカウント)。threads_posts.channel の既定値 'threads' は
-- 中文運用時代の行なので threads-zh に読み替える。
CREATE TABLE threads_accounts (
  channel TEXT PRIMARY KEY,           -- 'threads-zh' | 'threads-ja'
  access_token TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  username TEXT,
  expires_at TEXT NOT NULL,           -- トークン失効時刻 (UTC ISO8601)
  refreshed_at TEXT NOT NULL          -- 最終リフレッシュ時刻
);

-- 既存の接続 (中文アカウント) を引き継ぐ。
INSERT INTO threads_accounts
  (channel, access_token, threads_user_id, username, expires_at, refreshed_at)
  SELECT 'threads-zh', access_token, threads_user_id, username,
         expires_at, refreshed_at
  FROM threads_auth;

DROP TABLE threads_auth;

UPDATE threads_posts SET channel = 'threads-zh' WHERE channel = 'threads';
