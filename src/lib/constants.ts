export const MAX_TWEET_LENGTH = 280;

export const MAX_IMAGES = 4;

export const RETWEET_TYPES = ["retweet", "quote"] as const;
export type RetweetType = (typeof RETWEET_TYPES)[number];

// Home (/) の scrollY を一時保存する sessionStorage キー。ScrollMemory が
// 保存/復元し、WordmarkLink が「/ へ戻る」操作時にクリアする。
export const HOME_SCROLL_KEY = "k-home-scroll-y";
