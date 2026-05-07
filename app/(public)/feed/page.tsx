import type { Metadata } from "next";

import { TweetFeed } from "@/components/feed/TweetFeed";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Feed",
  description: "echolog のすべてのツイート",
};

export default function FeedPage() {
  return (
    <main className="mx-auto max-w-2xl w-full px-4 py-8">
      <TweetFeed showHeader={false} />
    </main>
  );
}
