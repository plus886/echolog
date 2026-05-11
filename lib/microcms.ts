import { createClient, type MicroCMSQueries } from "microcms-js-sdk";

import { env } from "@/lib/env";
import type {
  Day,
  DayListResponse,
  Tweet,
  TweetFields,
  TweetListResponse,
} from "@/types/microcms";

const client = createClient({
  serviceDomain: env.MICROCMS_SERVICE_DOMAIN,
  apiKey: env.MICROCMS_API_KEY,
});

// ポートフォリオの gallery 用：別ワークスペース formosa-chiaroscuro。
const formosaClient = createClient({
  serviceDomain: env.FORMOSA_MICROCMS_SERVICE_DOMAIN,
  apiKey: env.FORMOSA_MICROCMS_API_KEY,
});

const TWEETS_ENDPOINT = "tweets";
const DAYS_ENDPOINT = "days";
const DEFAULT_REVALIDATE = 3600;

const cachedRequestInit: RequestInit = {
  next: { revalidate: DEFAULT_REVALIDATE },
};

// depth=1 で parent / retweetOf を 1段だけ展開して取得する。
const DEFAULT_DEPTH = 1 as const;

function withDefaultDepth(queries?: MicroCMSQueries): MicroCMSQueries {
  return { depth: DEFAULT_DEPTH, ...queries };
}

export async function listTweets(
  queries?: MicroCMSQueries,
): Promise<TweetListResponse> {
  const response = await client.getList<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    queries: withDefaultDepth(queries),
    customRequestInit: cachedRequestInit,
  });
  return response as TweetListResponse;
}

// 親ツイート（=スレッドの起点）のみを取得する。
// /feed と TweetFeed コンポーネントで使う。
export async function listRootTweets(
  queries?: MicroCMSQueries,
): Promise<TweetListResponse> {
  return listTweets({
    ...queries,
    filters: combineFilters("parent[not_exists]", queries?.filters),
  });
}

// あるツイートのスレッド（直接の子リプライ）を時系列昇順で取得する。
export async function listThreadReplies(
  rootId: string,
  queries?: MicroCMSQueries,
): Promise<TweetListResponse> {
  return listTweets({
    ...queries,
    filters: combineFilters(
      `parent[equals]${rootId}`,
      queries?.filters,
    ),
    orders: queries?.orders ?? "publishedAt",
  });
}

export async function getTweet(
  contentId: string,
  queries?: MicroCMSQueries,
): Promise<Tweet> {
  const tweet = await client.getListDetail<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    contentId,
    queries: withDefaultDepth(queries),
    customRequestInit: cachedRequestInit,
  });
  return tweet as Tweet;
}

function combineFilters(
  base: string,
  extra: string | undefined,
): string {
  return extra ? `${base}[and]${extra}` : base;
}

export async function listDays(
  queries?: MicroCMSQueries,
): Promise<DayListResponse> {
  const response = await formosaClient.getList<Day>({
    endpoint: DAYS_ENDPOINT,
    queries: { limit: 50, orders: "-date", ...queries },
    customRequestInit: cachedRequestInit,
  });
  return response as DayListResponse;
}
