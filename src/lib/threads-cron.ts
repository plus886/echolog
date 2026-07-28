import { refreshLongLivedToken } from "@/lib/threads";
import {
  claimDueThreadsPosts,
  listThreadsAccounts,
  saveThreadsAccount,
  type ThreadsAccount,
} from "@/lib/threads-db";
import { publishThreadsPost } from "@/lib/threads-publish";
import { syncReplyStatsBatch } from "@/lib/threads-replies";

// Cron Trigger (wrangler.jsonc triggers, 5 分毎) の処理本体。
//  1. 予定時刻が来た予約投稿の配信
//  2. 届いた返信の同期 (管理画面のバッジ用。返信の見落とし防止)
//  3. 長期トークンの自動リフレッシュ

const REFRESH_INTERVAL_DAYS = 7;

export async function runThreadsCron(): Promise<void> {
  try {
    await publishDuePosts();
  } catch (e) {
    console.error("[threads-cron] publish sweep failed", e);
  }
  try {
    await syncReplyStatsBatch();
  } catch (e) {
    console.error("[threads-cron] reply sync failed", e);
  }
  try {
    await refreshTokens();
  } catch (e) {
    console.error("[threads-cron] token refresh failed", e);
  }
}

// 予定時刻を過ぎた scheduled をアトミックに claim して順に投稿する。
// 1 日最大 2 件の運用なので直列で十分。個別の失敗は行の status='failed'
// に記録され (publishThreadsPost 内)、ダッシュボードから再試行できる。
async function publishDuePosts(): Promise<void> {
  const due = await claimDueThreadsPosts(new Date().toISOString());
  for (const post of due) {
    const result = await publishThreadsPost(post);
    console.log(
      `[threads-cron] post ${post.id} (day ${post.dayId}): ` +
        (result.ok ? "published" : `failed: ${result.error}`),
    );
  }
}

// 各チャンネルの長期トークン (約 60 日) を 7 日おきに転がしてゆく。
// リフレッシュ API は「発行 24 時間後〜失効前」のトークンにしか使えない
// ため、失効済みなら何もしない (管理画面の再接続待ち。期限はダッシュ
// ボードに表示される)。片方の失敗がもう片方を止めないよう個別に捕捉。
async function refreshTokens(): Promise<void> {
  const accounts = await listThreadsAccounts();
  for (const account of accounts) {
    try {
      await maybeRefreshToken(account);
    } catch (e) {
      console.error(
        `[threads-cron] token refresh failed (${account.channel})`,
        e,
      );
    }
  }
}

async function maybeRefreshToken(account: ThreadsAccount): Promise<void> {
  const now = Date.now();
  const refreshedAt = Date.parse(account.refreshedAt);
  const expiresAt = Date.parse(account.expiresAt);

  if (Number.isFinite(expiresAt) && now > expiresAt) {
    console.warn(
      `[threads-cron] token expired (${account.channel}); reconnect from /admin`,
    );
    return;
  }
  if (
    Number.isFinite(refreshedAt) &&
    now - refreshedAt < REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000
  ) {
    return;
  }

  const refreshed = await refreshLongLivedToken(account.accessToken);
  await saveThreadsAccount({
    ...account,
    accessToken: refreshed.accessToken,
    expiresAt: new Date(now + refreshed.expiresInSec * 1000).toISOString(),
    refreshedAt: new Date(now).toISOString(),
  });
  console.log(`[threads-cron] token refreshed (${account.channel})`);
}
