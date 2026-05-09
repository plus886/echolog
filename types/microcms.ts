import type {
  MicroCMSContentId,
  MicroCMSDate,
  MicroCMSImage,
  MicroCMSListResponse,
} from "microcms-js-sdk";

import type { RetweetType } from "@/lib/constants";

export type EchologDate = {
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  revisedAt: string;
};

// depth=1 で展開された参照ツイート（自身は parent / retweetOf を持たない）
export type TweetReference = {
  body?: string;
  images?: MicroCMSImage[];
  retweetType?: [RetweetType] | [];
} & MicroCMSContentId &
  EchologDate;

export type TweetFields = {
  body?: string;
  images?: MicroCMSImage[];
  parent?: TweetReference;
  retweetOf?: TweetReference;
  retweetType?: [RetweetType] | [];
};

export type Tweet = TweetFields & MicroCMSContentId & EchologDate;

// 管理画面で扱う型。publishedAt が無い（=下書き）状態もありうる。
export type AdminTweet = TweetFields & MicroCMSContentId & MicroCMSDate;

export type TweetListResponse = Omit<MicroCMSListResponse<TweetFields>, "contents"> & {
  contents: Tweet[];
};

export type AdminTweetListResponse = Omit<
  MicroCMSListResponse<TweetFields>,
  "contents"
> & {
  contents: AdminTweet[];
};

export function getRetweetKind(
  tweet: Pick<TweetFields, "retweetOf" | "retweetType">,
): "retweet" | "quote" | null {
  if (!tweet.retweetOf) return null;
  const kind = tweet.retweetType?.[0];
  if (kind === "retweet") return "retweet";
  if (kind === "quote") return "quote";
  return null;
}
