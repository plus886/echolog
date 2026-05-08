import "server-only";

import { createClient, type MicroCMSQueries } from "microcms-js-sdk";

import { env } from "@/lib/env";
import type {
  AdminTweet,
  AdminTweetListResponse,
  TweetFields,
} from "@/types/microcms";

const TWEETS_ENDPOINT = "tweets";

let cachedClient: ReturnType<typeof createClient> | null = null;

function getWriteClient() {
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

const noStoreInit: RequestInit = { cache: "no-store" };

export type TweetWriteFields = Pick<
  TweetFields,
  "body" | "images" | "retweetType"
> & {
  parent?: string;
  retweetOf?: string;
};

export async function createTweet(
  content: TweetWriteFields,
  options?: { isDraft?: boolean },
): Promise<{ id: string }> {
  return getWriteClient().create({
    endpoint: TWEETS_ENDPOINT,
    content,
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
    content,
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

// admin の閲覧系。全て fresh データを取りたいので fetch cache を bypass。
// status query は microCMS の高権限キーで draft を含めて取得するための拡張。
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
