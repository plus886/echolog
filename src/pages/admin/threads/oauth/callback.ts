import type { APIRoute } from "astro";

import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchThreadsProfile,
  THREADS_STATE_COOKIE,
} from "@/lib/threads";
import { isThreadsChannel, THREADS_CHANNELS } from "@/lib/threads-channels";
import { getThreadsAccount, saveThreadsAccount } from "@/lib/threads-db";

// Threads OAuth コールバック。Meta のサーバが直接叩く URL ではなく、
// 認可後にオーナーのブラウザがリダイレクトされて戻ってくる先なので、
// /admin 配下 (Access 保護下) に置ける。結果は /admin?threads=... の
// クエリで返し、ThreadsManager が表示して URL から消す。
export const GET: APIRoute = async (context) => {
  const fail = (reason: string) =>
    context.redirect(`/admin?threads_error=${reason}`, 302);

  const params = context.url.searchParams;
  const saved = context.cookies.get(THREADS_STATE_COOKIE)?.value ?? "";
  context.cookies.delete(THREADS_STATE_COOKIE, {
    path: "/admin/threads/oauth",
  });
  // 値は "state.channel" (start.ts 参照)。
  const dot = saved.indexOf(".");
  const savedState = dot > 0 ? saved.slice(0, dot) : "";
  const channel = dot > 0 ? saved.slice(dot + 1) : "";

  if (params.get("error")) return fail("denied");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !savedState || state !== savedState) {
    return fail("state");
  }
  if (!isThreadsChannel(channel)) return fail("state");

  try {
    // code → 短期トークン → 長期トークン (約60日) → プロフィール確認。
    const short = await exchangeCodeForToken(code);
    const long = await exchangeForLongLivedToken(short.accessToken);
    const profile = await fetchThreadsProfile(long.accessToken);

    // もう一方のチャンネルと同じアカウントなら保存しない。気づかず同じ
    // アカウントへ 2 重投稿する事故を防ぐ (threads.net 側でログイン中の
    // アカウントがそのまま認可されるため起きやすい)。
    for (const other of THREADS_CHANNELS) {
      if (other === channel) continue;
      const existing = await getThreadsAccount(other);
      if (existing && existing.threadsUserId === profile.id) {
        return fail("same_account");
      }
    }

    const now = Date.now();
    await saveThreadsAccount({
      channel,
      accessToken: long.accessToken,
      threadsUserId: profile.id || short.userId,
      username: profile.username,
      expiresAt: new Date(now + long.expiresInSec * 1000).toISOString(),
      refreshedAt: new Date(now).toISOString(),
    });
    return context.redirect(`/admin?threads=connected&channel=${channel}`, 302);
  } catch (e) {
    console.error("[threads] oauth callback failed", e);
    return fail("exchange");
  }
};
