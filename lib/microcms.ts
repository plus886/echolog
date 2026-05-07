import { createClient, type MicroCMSQueries } from "microcms-js-sdk";

import { env } from "@/lib/env";
import type {
  Tweet,
  TweetFields,
  TweetListResponse,
} from "@/types/microcms";

const client = createClient({
  serviceDomain: env.MICROCMS_SERVICE_DOMAIN,
  apiKey: env.MICROCMS_API_KEY,
});

const TWEETS_ENDPOINT = "tweets";
const DEFAULT_REVALIDATE = 3600;

const cachedRequestInit: RequestInit = {
  next: { revalidate: DEFAULT_REVALIDATE },
};

export async function listTweets(
  queries?: MicroCMSQueries,
): Promise<TweetListResponse> {
  const response = await client.getList<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    queries,
    customRequestInit: cachedRequestInit,
  });
  return response as TweetListResponse;
}

export async function getTweet(
  contentId: string,
  queries?: MicroCMSQueries,
): Promise<Tweet> {
  const tweet = await client.getListDetail<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    contentId,
    queries,
    customRequestInit: cachedRequestInit,
  });
  return tweet as Tweet;
}
