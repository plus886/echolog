import type { Metadata } from "next";

import { AdminTweetRow } from "@/components/admin/AdminTweetRow";
import { listAdminTweets } from "@/lib/microcms-management";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drafts",
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
    <main className="mx-auto mt-6 w-full max-w-[720px]">
      <h1 className="mb-8 k-label-mini">
        Drafts
      </h1>

      {contents.length === 0 ? (
        <p className="font-serif text-[15px] leading-[1.8] text-(--ink-70) italic">
          下書きはありません。
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {contents.map((tweet) => (
            <li
              key={tweet.id}
              className="border-t border-(--ink-15) first:border-t-0"
            >
              <AdminTweetRow tweet={tweet} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
