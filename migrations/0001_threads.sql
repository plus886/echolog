-- Threads 予約投稿キュー + 投稿ログ。1 予約 = 1 行で、状態遷移がそのまま
-- ログになる (予約中の取消は行削除、published 後の削除は status='deleted'
-- で履歴を残す)。channel は将来チャンネルが増えたときの識別用で、現状は
-- 'threads' 固定。
CREATE TABLE threads_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL DEFAULT 'threads',
  day_id TEXT NOT NULL,             -- microCMS formosa/days のコンテンツ ID
  image_url TEXT NOT NULL,          -- 投稿画像 (microCMS アセット URL)
  scheduled_at TEXT NOT NULL,       -- 配信予定時刻 (UTC ISO8601)
  status TEXT NOT NULL DEFAULT 'scheduled',
    -- scheduled | publishing | published | failed | deleted
  posted_text TEXT,                 -- 実際に投稿した本文 (publish 時 snapshot)
  threads_media_id TEXT,            -- publish 後の Threads メディア ID
  threads_permalink TEXT,
  reply_media_id TEXT,              -- ぶら下げた URL リプライのメディア ID
  error TEXT,                       -- 失敗時のメッセージ (失敗フラグ兼用)
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE INDEX idx_threads_posts_status_scheduled
  ON threads_posts (status, scheduled_at);
CREATE INDEX idx_threads_posts_day ON threads_posts (day_id);

-- Threads の長期アクセストークン (約 60 日、cron で自動リフレッシュ)。
-- オーナー 1 アカウント運用なので常に 1 行 (id = 1) のみ。
CREATE TABLE threads_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  threads_user_id TEXT NOT NULL,
  username TEXT,
  expires_at TEXT NOT NULL,         -- トークン失効時刻 (UTC ISO8601)
  refreshed_at TEXT NOT NULL        -- 最終リフレッシュ時刻
);
