export const MAX_TWEET_LENGTH = 280;

export const FEED_PAGE_SIZE = 20;

export const RETWEET_TYPES = ["retweet", "quote"] as const;
export type RetweetType = (typeof RETWEET_TYPES)[number];
