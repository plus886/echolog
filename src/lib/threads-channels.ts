// Threads のチャンネル定義。チャンネル = 言語別の Threads アカウント。
//  - threads-zh: 中文詩 (passageZh) を台湾向けアカウントへ (初期からの運用)
//  - threads-ja: 日本語短歌 (passageJa) を日本向けアカウントへ
// 予約の入り口 (文章管理タブの Threads 予約) は 1 回で両チャンネルに積み、
// 同じ時刻に投稿する。以後の管理 (日時変更・取消・返信・削除) は行単位。
//
// server / client 両方から import するので純データに保つ (env に触らない)。

export const THREADS_CHANNELS = ["threads-zh", "threads-ja"] as const;

export type ThreadsChannel = (typeof THREADS_CHANNELS)[number];

export function isThreadsChannel(value: unknown): value is ThreadsChannel {
  return (THREADS_CHANNELS as readonly unknown[]).includes(value);
}

export const CHANNEL_LABEL: Record<ThreadsChannel, string> = {
  "threads-zh": "中文",
  "threads-ja": "日本語",
};

// 本体ポストに付けるトピックタグ。Threads は 1 投稿 1 タグまでで、
// API へは # なしの文字列を渡す (1〜50 文字、"." と "&" は不可)。
// チャンネル固定 = 写真ごとの選択は不要、という運用上の決定。
export const CHANNEL_TOPIC_TAG: Record<ThreadsChannel, string> = {
  "threads-zh": "街頭攝影",
  "threads-ja": "短歌",
};

// リプライでぶら下げる・サムネイルから飛ぶギャラリーページ。photolog の
// i18n は日本語がルート、中文が /zh 接頭辞。
export function dayPageUrl(channel: ThreadsChannel, dayId: string): string {
  return channel === "threads-zh"
    ? `https://photo.kokaiji.tw/zh/days/${dayId}`
    : `https://photo.kokaiji.tw/days/${dayId}`;
}
