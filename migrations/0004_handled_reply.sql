-- 返信に「対応済み」の印を付けられるようにする。
--
-- Threads API には投稿や返信に「いいね」を付ける口が無い (Reply Management
-- は取得と hide/unhide だけ) ため、いいねの代わりに管理画面側で処理済みを
-- 記録する。値は「対応を済ませた最新の受信返信の ID」で、これが会話の
-- 最新の受信返信と一致していれば「要返信」を下ろす。
--
-- 1 件だけ持てば十分: 後から新しい返信が来れば ID が変わるので、
-- 自動的にまた「要返信」に戻る。
ALTER TABLE threads_posts ADD COLUMN handled_reply_id TEXT;
