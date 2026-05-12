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
// ホームの gallery quote 表示で使う。
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

// Portfolio gallery 用：最新25件 + 全件からランダム25件 (重複なし) を
// インタリーブして返す。ランダムは ISR revalidate ごとに更新。
export async function loadGalleryDays(): Promise<Day[]> {
  const LATEST_SIZE = 25;
  const RANDOM_SIZE = 25;

  const latestRes = await listDays({
    limit: LATEST_SIZE,
    orders: "-date",
  });
  const latest = latestRes.contents;
  const total = latestRes.totalCount;
  const restCount = Math.max(0, total - LATEST_SIZE);
  if (restCount <= 0) return latest;

  const sampleSize = Math.min(RANDOM_SIZE, restCount);
  const offsets = pickUniqueOffsets(LATEST_SIZE, total, sampleSize);
  const sampled = await Promise.all(
    offsets.map((offset) =>
      listDays({ limit: 1, offset, orders: "-date" })
        .then((r) => r.contents[0])
        .catch(() => undefined),
    ),
  );
  const random = sampled.filter((d): d is Day => Boolean(d));
  return interleave(latest, random);
}

function pickUniqueOffsets(
  lo: number,
  hiExclusive: number,
  count: number,
): number[] {
  const pool = hiExclusive - lo;
  const n = Math.min(count, pool);
  const arr = Array.from({ length: pool }, (_, i) => lo + i);
  for (let i = arr.length - 1; i > arr.length - 1 - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(arr.length - n);
}

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}
