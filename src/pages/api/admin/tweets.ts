import type { APIRoute } from "astro";

import { json } from "@/lib/http";
import {
  listAdminTweets,
  listMyRetweetTargetIds,
} from "@/lib/microcms-management";
import { buildThreads, flatThreads } from "@/lib/thread";

// 管理画面のライブ一覧用 read エンドポイント。投稿/削除/RT 後に
// AdminDashboard がこれを叩いて一覧を最新化する。投稿一覧は親子関係を
// スレッド化して返す。下書きはスレッド化せず単独ノードで返す。
// 認証は middleware が /api/admin/ を Cloudflare Access JWT で gate。

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const drafts = url.searchParams.get("status") === "DRAFT";

  try {
    if (drafts) {
      const list = await listAdminTweets({
        status: "DRAFT",
        limit: 50,
        orders: "-updatedAt",
      });
      return json({
        threads: flatThreads(list.contents),
        retweetedTargetIds: [],
      });
    }

    const [list, retweetedIds] = await Promise.all([
      listAdminTweets({ limit: 30, orders: "-publishedAt" }),
      listMyRetweetTargetIds(),
    ]);
    const threads = await buildThreads(list.contents);
    return json({ threads, retweetedTargetIds: [...retweetedIds] });
  } catch (e) {
    console.error("[api/admin/tweets] failed", e);
    return json({ error: "fetch-failed" }, { status: 500 });
  }
};
