import { notFound } from "next/navigation";

import { EditForm } from "@/components/admin/EditForm";
import { getAdminTweet } from "@/lib/microcms-management";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function EditTweetPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  let tweet;
  try {
    tweet = await getAdminTweet(id);
  } catch {
    notFound();
  }

  const isDraft = !tweet.publishedAt;

  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">編集</h1>
        {isDraft && (
          <span className="text-xs rounded bg-yellow-100 px-2 py-0.5 text-yellow-900">
            下書き
          </span>
        )}
      </header>

      <EditForm
        id={tweet.id}
        defaultBody={tweet.body ?? ""}
        isDraft={isDraft}
      />
    </main>
  );
}
