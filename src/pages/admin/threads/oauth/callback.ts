import type { APIRoute } from "astro";

import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchThreadsProfile,
  THREADS_STATE_COOKIE,
} from "@/lib/threads";
import { saveThreadsAuth } from "@/lib/threads-db";

// Threads OAuth コールバック。Meta のサーバが直接叩く URL ではなく、
// 認可後にオーナーのブラウザがリダイレクトされて戻ってくる先なので、
// /admin 配下 (Access 保護下) に置ける。結果は /admin?threads=... の
// クエリで返し、ThreadsManager が表示して URL から消す。
export const GET: APIRoute = async (context) => {
  const fail = (reason: string) =>
    context.redirect(`/admin?threads_error=${reason}`, 302);

  const params = context.url.searchParams;
  const savedState = context.cookies.get(THREADS_STATE_COOKIE)?.value;
  context.cookies.delete(THREADS_STATE_COOKIE, {
    path: "/admin/threads/oauth",
  });

  if (params.get("error")) return fail("denied");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !savedState || state !== savedState) {
    return fail("state");
  }

  try {
    // code → 短期トークン → 長期トークン (約60日) → プロフィール確認。
    const short = await exchangeCodeForToken(code);
    const long = await exchangeForLongLivedToken(short.accessToken);
    const profile = await fetchThreadsProfile(long.accessToken);
    const now = Date.now();
    await saveThreadsAuth({
      accessToken: long.accessToken,
      threadsUserId: profile.id || short.userId,
      username: profile.username,
      expiresAt: new Date(now + long.expiresInSec * 1000).toISOString(),
      refreshedAt: new Date(now).toISOString(),
    });
    return context.redirect("/admin?threads=connected", 302);
  } catch (e) {
    console.error("[threads] oauth callback failed", e);
    return fail("exchange");
  }
};
