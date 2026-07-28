import { fetchPostReplies, type ThreadsReply } from "@/lib/threads";
import type { ThreadsChannel } from "@/lib/threads-channels";
import {
  listPostsForReplySync,
  listThreadsAccounts,
  type ThreadsPost,
  updateThreadsReplyStats,
} from "@/lib/threads-db";

// 投稿に付いた返信の取得と、その要約 (件数 / 未返信か) の D1 同期。
// Threads API には「自分の全投稿への返信」をまとめて取る口が無く、投稿
// 1 件につき conversation を 1 回引く必要がある。そのため管理画面の表示
// では叩かず、cron が少しずつ同期した D1 の値をバッジに出す。

// 1 回の cron で同期する件数の上限 (= Threads API 呼び出し数の上限)。
const SYNC_BATCH = 5;
// 返信が付く見込みのある期間。これより古い投稿は巡回対象から外す。
const SYNC_WINDOW_DAYS = 90;

export type ReplyStats = { replyCount: number; needsReply: boolean };

// 会話から「届いた返信」を切り出す。URL をぶら下げた自分のリプライは
// 読むべき返信ではないので除く。
export function selectIncomingReplies(
  replies: ThreadsReply[],
  urlReplyMediaId: string | null,
): ThreadsReply[] {
  return replies.filter((r) => r.id !== urlReplyMediaId);
}

// 返信の要約。fetchPostReplies は chronological (古い順) で返すので、
// 末尾が最新。最新が自分以外なら「まだ返していない」と見なす。
export function summarizeReplies(replies: ThreadsReply[]): ReplyStats {
  const latest = replies[replies.length - 1];
  return {
    replyCount: replies.length,
    needsReply: Boolean(latest && !latest.isReplyOwnedByMe),
  };
}

// 1 件ぶん取得して D1 も更新する。返信一覧を開いたときにも使い、
// バッジの値が画面の中身とズレないようにする。
export async function syncPostReplies(
  post: ThreadsPost,
  token: string,
): Promise<{ replies: ThreadsReply[]; stats: ReplyStats }> {
  if (!post.threadsMediaId) {
    throw new Error("threads media id がありません");
  }
  const all = await fetchPostReplies(post.threadsMediaId, token);
  const replies = selectIncomingReplies(all, post.replyMediaId);
  const stats = summarizeReplies(replies);
  await updateThreadsReplyStats(post.id, stats);
  return { replies, stats };
}

// cron 用。同期が古い順に SYNC_BATCH 件だけ回す (チャンネル横断の 1 巡回。
// 行のチャンネルに応じたトークンで引く)。個別の失敗は握りつぶす
// (次の巡回で拾い直せるし、返信同期の失敗で cron 全体を止めたくない)。
export async function syncReplyStatsBatch(): Promise<void> {
  const accounts = await listThreadsAccounts();
  if (accounts.length === 0) return;
  const tokenByChannel = new Map<ThreadsChannel, string>(
    accounts.map((a) => [a.channel, a.accessToken]),
  );

  const after = new Date(
    Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const posts = await listPostsForReplySync(SYNC_BATCH, after);

  for (const post of posts) {
    const token = tokenByChannel.get(post.channel);
    if (!token) continue; // そのチャンネルが未接続なら次の巡回に回す
    try {
      const { stats } = await syncPostReplies(post, token);
      if (stats.needsReply) {
        console.log(
          `[threads-cron] post ${post.id} has ${stats.replyCount} reply(ies), needs reply`,
        );
      }
    } catch (e) {
      console.error("[threads-cron] reply sync failed", post.id, e);
    }
  }
}
