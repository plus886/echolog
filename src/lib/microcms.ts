import { createClient, type MicroCMSQueries } from "microcms-js-sdk";

import { getEnv } from "@/lib/env";
import type {
  Day,
  DayListResponse,
  Location,
  LocationFields,
  LocationListResponse,
  Tweet,
  TweetFields,
  TweetListResponse,
} from "@/types/microcms";

// 注意点:
// - Astro on Cloudflare では起動時に env が読めないため、関数呼び出し時に
//   getEnv() で取り出して都度クライアントを作る (生成は軽量)。
// - キャッシュ戦略は各 route の Cache-Control header で表現する
//   (lib/http.ts の setEdgeCache)。

function getEcholog() {
  const env = getEnv();
  return createClient({
    serviceDomain: env.MICROCMS_SERVICE_DOMAIN,
    apiKey: env.MICROCMS_API_KEY,
  });
}

function getFormosa() {
  const env = getEnv();
  return createClient({
    serviceDomain: env.FORMOSA_MICROCMS_SERVICE_DOMAIN,
    apiKey: env.FORMOSA_MICROCMS_API_KEY,
  });
}

const TWEETS_ENDPOINT = "tweets";
const DAYS_ENDPOINT = "days";
const LOCATIONS_ENDPOINT = "locations";

// depth=1 で parent / retweetOf を 1段だけ展開して取得する。
const DEFAULT_DEPTH = 1 as const;

function withDefaultDepth(queries?: MicroCMSQueries): MicroCMSQueries {
  return { depth: DEFAULT_DEPTH, ...queries };
}

export async function listTweets(
  queries?: MicroCMSQueries,
): Promise<TweetListResponse> {
  const response = await getEcholog().getList<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    queries: withDefaultDepth(queries),
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
    filters: combineFilters(`parent[equals]${rootId}`, queries?.filters),
    orders: queries?.orders ?? "publishedAt",
  });
}

export async function getTweet(
  contentId: string,
  queries?: MicroCMSQueries,
): Promise<Tweet> {
  const tweet = await getEcholog().getListDetail<TweetFields>({
    endpoint: TWEETS_ENDPOINT,
    contentId,
    queries: withDefaultDepth(queries),
  });
  return tweet as Tweet;
}

function combineFilters(base: string, extra: string | undefined): string {
  return extra ? `${base}[and]${extra}` : base;
}

export async function listDays(
  queries?: MicroCMSQueries,
): Promise<DayListResponse> {
  const response = await getFormosa().getList<Day>({
    endpoint: DAYS_ENDPOINT,
    queries: { limit: 50, orders: "-date", ...queries },
  });
  return response as DayListResponse;
}

// 撮影地の全件。admin の写真投稿フォームで選択肢に出す。microCMS の
// limit 上限は 100 なので、件数が増えても取りこぼさないようページを繰る。
//
// microCMS は Cache-Control を返さない (etag のみ) ため、既定のままだと
// Workers の fetch キャッシュに載って追加した撮影地が出てこないことがある。
// admin 用途なので camera/lens のスキーマ取得と同様に no-store で毎回取る。
export async function listAllLocations(): Promise<Location[]> {
  const PAGE = 100;
  const all: Location[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = (await getFormosa().getList<LocationFields>({
      endpoint: LOCATIONS_ENDPOINT,
      queries: { limit: PAGE, offset },
      customRequestInit: { cache: "no-store" },
    })) as LocationListResponse;
    all.push(...res.contents);
    if (all.length >= res.totalCount || res.contents.length === 0) break;
  }
  return all;
}

// 撮影地 1 件。admin が alt 生成に渡す確定情報として引く (no-store)。
export async function getLocation(contentId: string): Promise<Location> {
  const location = await getFormosa().getListDetail<LocationFields>({
    endpoint: LOCATIONS_ENDPOINT,
    contentId,
    customRequestInit: { cache: "no-store" },
  });
  return location as Location;
}

// Portfolio gallery 用：投稿時点の新しい順 25 件 + それ以外からランダム
// 25 件 (重複なし) をインタリーブして返す。並びは公開ギャラリー
// (photo.kokaiji.tw) に合わせて投稿日時 (publishedAt) 基準。
export async function loadGalleryDays(): Promise<Day[]> {
  const LATEST_SIZE = 25;
  const RANDOM_SIZE = 25;

  const latestRes = await listDays({
    limit: LATEST_SIZE,
    orders: "-publishedAt",
  });
  const latest = latestRes.contents;
  const total = latestRes.totalCount;
  const restCount = Math.max(0, total - LATEST_SIZE);
  if (restCount <= 0) return latest;

  const sampleSize = Math.min(RANDOM_SIZE, restCount);
  const offsets = pickUniqueOffsets(LATEST_SIZE, total, sampleSize);
  const sampled = await Promise.all(
    offsets.map((offset) =>
      listDays({ limit: 1, offset, orders: "-publishedAt" })
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
