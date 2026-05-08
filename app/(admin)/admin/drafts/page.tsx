import type { Metadata } from "next";

import { AdminTweetRow } from "@/components/admin/AdminTweetRow";
import { listAdminTweets } from "@/lib/microcms-management";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "下書き",
};

export default async function DraftsPage() {
  // microCMS の高権限キーが必要。Service Key またはコンテンツ全権限ロールのキー想定。
  // status=DRAFT で下書きのみ取得。
  const { contents } = await listAdminTweets({
    status: "DRAFT",
    limit: 50,
    orders: "-updatedAt",
  });

  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">下書き一覧</h1>

      {contents.length === 0 ? (
        <p className="text-sm text-muted">下書きはありません。</p>
      ) : (
        <div className="rounded-md border border-border px-3">
          {contents.map((tweet) => (
            <AdminTweetRow key={tweet.id} tweet={tweet} />
          ))}
        </div>
      )}
    </main>
  );
}
