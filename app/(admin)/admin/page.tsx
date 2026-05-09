import type { Metadata } from "next";

import { AdminTweetRow } from "@/components/admin/AdminTweetRow";
import {
  ComposeForm,
  type ComposeMode,
} from "@/components/admin/ComposeForm";
import {
  getAdminTweet,
  listAdminTweets,
  listMyRetweetTargetIds,
} from "@/lib/microcms-management";
import type { TweetReference } from "@/types/microcms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
};

type SearchParams = {
  mode?: string;
  target?: string;
};

async function resolveMode(
  params: SearchParams,
): Promise<ComposeMode> {
  const { mode, target } = params;
  if (!target || (mode !== "reply" && mode !== "quote")) {
    return { kind: "new" };
  }
  try {
    const tweet = await getAdminTweet(target);
    const ref: TweetReference = {
      id: tweet.id,
      createdAt: tweet.createdAt,
      updatedAt: tweet.updatedAt,
      publishedAt: tweet.publishedAt ?? tweet.createdAt,
      revisedAt: tweet.revisedAt ?? tweet.updatedAt,
      body: tweet.body,
      images: tweet.images,
      retweetType: tweet.retweetType,
    };
    return mode === "reply"
      ? { kind: "reply", target: ref }
      : { kind: "quote", target: ref };
  } catch {
    return { kind: "new" };
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [composeMode, listResponse, retweetedTargetIds] = await Promise.all([
    resolveMode(params),
    listAdminTweets({ limit: 30, orders: "-publishedAt" }),
    listMyRetweetTargetIds(),
  ]);
  const tweets = listResponse.contents;

  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
      <section>
        <h1 className="mb-4 text-lg font-semibold">
          {composeMode.kind === "new"
            ? "新規投稿"
            : composeMode.kind === "reply"
              ? "セルフリプライ"
              : "引用RT"}
        </h1>
        <ComposeForm mode={composeMode} />
      </section>

      <aside>
        <h2 className="mb-2 text-sm font-semibold text-muted">
          最近のツイート
        </h2>
        {tweets.length === 0 ? (
          <p className="text-sm text-muted">まだ投稿がありません。</p>
        ) : (
          <div className="rounded-md border border-border px-3">
            {tweets.map((tweet) => (
              <AdminTweetRow
                key={tweet.id}
                tweet={tweet}
                retweetedTargetIds={retweetedTargetIds}
              />
            ))}
          </div>
        )}
      </aside>
    </main>
  );
}
