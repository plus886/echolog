import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { formatAbsoluteTimestamp } from "@/lib/format";
import { getTweet } from "@/lib/microcms";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { id: string };

const META_TITLE_LENGTH = 40;
const META_DESC_LENGTH = 120;

async function fetchTweetOrNull(id: string) {
  try {
    return await getTweet(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const tweet = await fetchTweetOrNull(id);

  if (!tweet) {
    return { title: "Tweet not found" };
  }

  const body = tweet.body ?? "";
  const title = body.slice(0, META_TITLE_LENGTH) || "echolog tweet";
  const description = body.slice(0, META_DESC_LENGTH) || "echolog tweet";
  const ogImage = tweet.images?.[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function TweetPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const tweet = await fetchTweetOrNull(id);

  if (!tweet) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-8">
      <nav className="mb-6 text-sm text-muted">
        <Link href="/feed" prefetch={false} className="hover:underline">
          ← フィードに戻る
        </Link>
      </nav>

      <article className="border border-border rounded-lg p-6">
        {tweet.body && (
          <p className="whitespace-pre-wrap text-lg leading-relaxed">
            {tweet.body}
          </p>
        )}

        {tweet.images && tweet.images.length > 0 && (
          <div
            className={`mt-4 grid gap-2 ${
              tweet.images.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {tweet.images.map((image) => (
              <div
                key={image.url}
                className="relative aspect-video overflow-hidden rounded-md border border-border"
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 480px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <footer className="mt-4 text-sm text-muted">
          <time dateTime={tweet.publishedAt}>
            {formatAbsoluteTimestamp(tweet.publishedAt)}
          </time>
        </footer>
      </article>
    </main>
  );
}
