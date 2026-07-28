import { handle } from "@astrojs/cloudflare/handler";

import { runThreadsCron } from "@/lib/threads-cron";

// カスタム Worker エントリ (wrangler.jsonc の main)。既定の
// @astrojs/cloudflare/entrypoints/server は fetch のみなので、Cron Triggers
// (Threads 予約投稿の配信) を受ける scheduled ハンドラを足すためにここで
// 両方 export する。Astro app の解決は adapter の handle が内部で行う。
export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
  async scheduled(_controller, _env, ctx) {
    // env は各 lib が cloudflare:workers の env import で解決するので
    // 引き回さない (アプリ側 lib/env.ts と同じ流儀)。
    ctx.waitUntil(runThreadsCron());
  },
} satisfies ExportedHandler<Env>;
