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
// i18n: body は日本語、bodyZh は台湾華語。bodyZh が未投入なら表示側
// (localizedBody) が body にフォールバックする。
export type TweetReference = {
  body?: string;
  bodyZh?: string;
  images?: MicroCMSImage[];
  retweetType?: [RetweetType] | [];
} & MicroCMSContentId &
  EchologDate;

export type TweetFields = {
  body?: string;
  bodyZh?: string;
  images?: MicroCMSImage[];
  parent?: TweetReference;
  retweetOf?: TweetReference;
  retweetType?: [RetweetType] | [];
};

export type Tweet = TweetFields & MicroCMSContentId & EchologDate;

// 管理画面で扱う型。publishedAt が無い（=下書き）状態もありうる。
export type AdminTweet = TweetFields & MicroCMSContentId & MicroCMSDate;

export type TweetListResponse = Omit<
  MicroCMSListResponse<TweetFields>,
  "contents"
> & {
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

// ---- Portfolio gallery (formosa-chiaroscuro / days) ----

// microCMS の days API。select フィールド (camera / lens) は読み取り時
// 値文字列の配列で返る。passage* は ja / zh の 2 言語キャプション。
// alt* は検索最適化・スクリーンリーダー向けの 2 言語代替テキスト。
export type DayFields = {
  image: MicroCMSImage;
  date: string;
  camera?: string[];
  lens?: string[];
  featured?: boolean;
  passageJa?: string;
  passageZh?: string;
  altJa?: string;
  altZh?: string;
};

export type Day = DayFields & MicroCMSContentId & EchologDate;

export type DayListResponse = Omit<
  MicroCMSListResponse<DayFields>,
  "contents"
> & {
  contents: Day[];
};

// days への書き込み入力。microCMS の非対称仕様に合わせ、image は URL
// 文字列、select は単一でも値文字列の配列で POST する (変換は
// formosa-management.ts の toDaysPayload が担当)。
export type DayWriteFields = {
  imageUrl: string;
  camera: string;
  lens?: string;
  featured?: boolean;
  passageJa?: string;
  passageZh?: string;
  altJa?: string;
  altZh?: string;
  date?: string;
};
