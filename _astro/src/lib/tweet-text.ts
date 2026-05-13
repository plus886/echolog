// twitter-text 3.x の ESM ビルドは default export only。@types は named export を
// 宣言しているが実体に合わないため、default 経由で取り出す。
import twitterText from "twitter-text";

import { MAX_TWEET_LENGTH } from "@/lib/constants";

const { parseTweet } = twitterText;

export type TweetTextStatus = {
  length: number;
  remaining: number;
  isOver: boolean;
  isWarning: boolean;
  isValid: boolean;
};

const WARNING_THRESHOLD = 20;

export function evaluateTweetText(text: string): TweetTextStatus {
  const { weightedLength } = parseTweet(text);
  const remaining = MAX_TWEET_LENGTH - weightedLength;
  return {
    length: weightedLength,
    remaining,
    isOver: remaining < 0,
    isWarning: remaining <= WARNING_THRESHOLD && remaining >= 0,
    isValid: weightedLength > 0 && weightedLength <= MAX_TWEET_LENGTH,
  };
}
