import type {
  MicroCMSContentId,
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

export type TweetReference = MicroCMSContentId & EchologDate;

export type TweetFields = {
  body?: string;
  images?: MicroCMSImage[];
  parent?: TweetReference;
  retweetOf?: TweetReference;
  retweetType?: [RetweetType] | [];
};

export type Tweet = TweetFields & MicroCMSContentId & EchologDate;

export type TweetListResponse = Omit<MicroCMSListResponse<TweetFields>, "contents"> & {
  contents: Tweet[];
};
