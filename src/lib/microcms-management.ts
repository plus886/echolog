import {
  createClient,
  createManagementClient,
  type MicroCMSQueries,
} from "microcms-js-sdk";

import { getEnv } from "@/lib/env";
import type {
  AdminTweet,
  AdminTweetListResponse,
  TweetFields,
} from "@/types/microcms";

// 注意点:
//  - "server-only" 相当が Astro に無い。本ファイルを client component から
//    import すると vite が bundle に含めてしまうので、呼び出しは api routes
//    / Astro Actions / SSR pages からのみにする。
//  - cachedClient は関数内で lazy 化。getEnv() は呼ばれた時に Cloudflare:
//    workers env が読める前提のため、module top-level で env を読まない。

const TWEETS_ENDPOINT = "tweets";

let cachedClient: ReturnType<typeof createClient> | null = null;
let cachedManagementClient: ReturnType<typeof createManagementClient> | null =
  null;

function getWriteClient() {
  const env = getEnv();
  if (!env.MICROCMS_MANAGEMENT_API_KEY) {
    throw new Error(
      "MICROCMS_MANAGEMENT_API_KEY is not set. Required for write operations.",
    );
  }
  if (!cachedClient) {
    cachedClient = createClient({
      serviceDomain: env.MICROCMS_SERVICE_DOMAIN,
      apiKey: env.MICROCMS_MANAGEMENT_API_KEY,
    });
  }
  return cachedClient;
}

function getManagementClient() {
  const env = getEnv();
  if (!env.MICROCMS_MANAGEMENT_API_KEY) {
    throw new Error(
      "MICROCMS_MANAGEMENT_API_KEY is not set. Required for media uploads.",
    );
  }
  if (!cachedManagementClient) {
    cachedManagementClient = createManagementClient({
      serviceDomain: env.MICROCMS_SERVICE_DOMAIN,
      apiKey: env.MICROCMS_MANAGEMENT_API_KEY,
    });
  }
  return cachedManagementClient;
}

export async function uploadMedia(file: File): Promise<{ url: string }> {
  return getManagementClient().uploadMedia({ data: file });
}

const noStoreInit: RequestInit = { cache: "no-store" };

export type TweetWriteFields = Pick<
  TweetFields,
  "body" | "images" | "retweetType"
> & {
  parent?: string;
  retweetOf?: string;
};

// microCMS の「画像（複数）」フィールドは GET 時は { url, width?, height? }[]、
// POST/PATCH 時は URL の string[] を要求する非対称仕様。
function toMicroCMSPayload(
  content: Partial<TweetWriteFields>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...content };
  if (content.images) {
    payload.images = content.images.map((image) => image.url);
  }
  return payload;
}

export async function createTweet(
  content: TweetWriteFields,
  options?: { isDraft?: boolean },
): Promise<{ id: string }> {
  return getWriteClient().create({
    endpoint: TWEETS_ENDPOINT,
    content: toMicroCMSPayload(content),
    isDraft: options?.isDraft ?? false,
    customRequestInit: noStoreInit,
  });
}

export async function updateTweet(
  contentId: string,
  content: Partial<TweetWriteFields>,
  options?: { isDraft?: boolean },
): Promise<{ id: string }> {
  return getWriteClient().update({
    endpoint: TWEETS_ENDPOINT,
    contentId,
    content: toMicroCMSPayload(content),
    isDraft: options?.isDraft,
    customRequestInit: noStoreInit,
  });
}

export async function deleteTweet(contentId: string): Promise<void> {
  await getWriteClient().delete({
    endpoint: TWEETS_ENDPOINT,
    contentId,
    customRequestInit: noStoreInit,
  });
}

// admin の閲覧系。fresh データを取りたいので fetch cache を bypass。
type AdminQueries = MicroCMSQueries & {
  status?: "DRAFT" | "PUBLISH" | "PUBLISH_AND_DRAFT";
};

export async function listAdminTweets(
  queries?: AdminQueries,
): Promise<AdminTweetListResponse> {
  const response = await getWriteClient().getList<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    queries: queries as MicroCMSQueries,
    customRequestInit: noStoreInit,
  });
  return response as unknown as AdminTweetListResponse;
}

export async function getAdminTweet(
  contentId: string,
  queries?: AdminQueries,
): Promise<AdminTweet> {
  const tweet = await getWriteClient().getListDetail<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    contentId,
    queries: queries as MicroCMSQueries,
    customRequestInit: noStoreInit,
  });
  return tweet as unknown as AdminTweet;
}

// 自分が retweet（コメントなし RT）した元ツイート ID の集合を返す。
export async function listMyRetweetTargetIds(): Promise<Set<string>> {
  const { contents } = await listAdminTweets({
    filters: "retweetType[contains]retweet",
    fields: "id,retweetOf",
    depth: 1,
    limit: 100,
  });
  const ids = new Set<string>();
  for (const c of contents) {
    if (c.retweetOf?.id) ids.add(c.retweetOf.id);
  }
  return ids;
}

// 同一ツイートに対する retweet（コメントなし RT）が既に存在するか確認。
export async function hasExistingRetweet(targetId: string): Promise<boolean> {
  const { totalCount } = await listAdminTweets({
    filters: `retweetOf[equals]${targetId}[and]retweetType[contains]retweet`,
    fields: "id",
    limit: 1,
  });
  return totalCount > 0;
}
