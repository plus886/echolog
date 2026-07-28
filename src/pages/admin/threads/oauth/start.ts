import type { APIRoute } from "astro";

import {
  buildThreadsAuthorizeUrl,
  getThreadsAppConfig,
  THREADS_STATE_COOKIE,
} from "@/lib/threads";
import { isThreadsChannel } from "@/lib/threads-channels";

// Threads OAuth の開始。?channel= でどの言語アカウントの接続かを受け取り、
// CSRF 対策の state と一緒に cookie へ置いて Meta の認可画面へ 302 する。
// /admin 配下なので Cloudflare Access + middleware の保護下にある。
//
// 注意: 認可されるのは threads.net に現在ログインしているアカウント。
// 中文 / 日本語で別アカウントを接続するときは、Threads 側でログイン中の
// アカウントを切り替えてから開くこと (docs/threads.md)。
export const GET: APIRoute = (context) => {
  if (!getThreadsAppConfig()) {
    return new Response(
      "THREADS_APP_ID / THREADS_APP_SECRET が未設定です (docs/threads.md 参照)",
      { status: 500 },
    );
  }
  const channel = context.url.searchParams.get("channel");
  if (!isThreadsChannel(channel)) {
    return new Response("channel が不正です", { status: 400 });
  }
  const state = crypto.randomUUID();
  // state (uuid) に "." は含まれないので、チャンネルを "." 区切りで同じ
  // cookie に同梱する (callback で分解して照合)。
  context.cookies.set(THREADS_STATE_COOKIE, `${state}.${channel}`, {
    path: "/admin/threads/oauth",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: 600,
  });
  return context.redirect(buildThreadsAuthorizeUrl(state), 302);
};
