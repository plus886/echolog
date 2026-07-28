import type { APIRoute } from "astro";

import {
  buildThreadsAuthorizeUrl,
  getThreadsAppConfig,
  THREADS_STATE_COOKIE,
} from "@/lib/threads";

// Threads OAuth の開始。CSRF 対策の state を cookie に置き、Meta の認可
// 画面へ 302 する。/admin 配下なので Cloudflare Access + middleware の
// 保護下にある (オーナーだけが開始できる)。
export const GET: APIRoute = (context) => {
  if (!getThreadsAppConfig()) {
    return new Response(
      "THREADS_APP_ID / THREADS_APP_SECRET が未設定です (docs/threads.md 参照)",
      { status: 500 },
    );
  }
  const state = crypto.randomUUID();
  context.cookies.set(THREADS_STATE_COOKIE, state, {
    path: "/admin/threads/oauth",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: 600,
  });
  return context.redirect(buildThreadsAuthorizeUrl(state), 302);
};
