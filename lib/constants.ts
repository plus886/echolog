export const MAX_TWEET_LENGTH = 280;

export const MAX_IMAGES = 4;

export const RETWEET_TYPES = ["retweet", "quote"] as const;
export type RetweetType = (typeof RETWEET_TYPES)[number];
