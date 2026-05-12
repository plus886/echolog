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
    <main className="mx-auto mt-6 w-full max-w-[720px]">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="k-label-mini">
          Edit
        </h1>
        {isDraft && (
          <span className="border border-(--ink-30) px-2 py-0.5 text-[11px] uppercase tracking-[0.1em] italic text-(--ink-70)">
            draft
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
