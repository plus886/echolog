import type { Metadata } from "next";

import { AdminTweetRow } from "@/components/admin/AdminTweetRow";
import { ComposeForm } from "@/components/admin/ComposeForm";
import { listAdminTweets } from "@/lib/microcms-management";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const { contents: tweets } = await listAdminTweets({
    limit: 30,
    orders: "-publishedAt",
  });

  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
      <section>
        <h1 className="mb-4 text-lg font-semibold">新規投稿</h1>
        <ComposeForm />
      </section>

      <aside>
        <h2 className="mb-2 text-sm font-semibold text-muted">
          最近の公開ツイート
        </h2>
        {tweets.length === 0 ? (
          <p className="text-sm text-muted">まだ投稿がありません。</p>
        ) : (
          <div className="rounded-md border border-border px-3">
            {tweets.map((tweet) => (
              <AdminTweetRow key={tweet.id} tweet={tweet} />
            ))}
          </div>
        )}
      </aside>
    </main>
  );
}
