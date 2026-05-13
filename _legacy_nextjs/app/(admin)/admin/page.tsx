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

  const heading =
    composeMode.kind === "new"
      ? "Compose"
      : composeMode.kind === "reply"
        ? "Self-reply"
        : "Quote retweet";

  return (
    <main className="mt-6 grid grid-cols-1 gap-x-10 gap-y-12 min-[880px]:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-6 k-label-mini">
          {heading}
        </h1>
        <ComposeForm mode={composeMode} />
      </section>

      <aside>
        <h2 className="mb-6 k-label-mini">
          Recent
        </h2>
        {tweets.length === 0 ? (
          <p className="font-serif text-[15px] leading-[1.8] text-(--ink-70) italic">
            まだ投稿がありません。
          </p>
        ) : (
          <ol className="m-0 flex list-none flex-col p-0">
            {tweets.map((tweet) => (
              <li
                key={tweet.id}
                className="border-t border-(--ink-15) first:border-t-0"
              >
                <AdminTweetRow
                  tweet={tweet}
                  retweetedTargetIds={retweetedTargetIds}
                />
              </li>
            ))}
          </ol>
        )}
      </aside>
    </main>
  );
}
