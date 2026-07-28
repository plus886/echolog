import { getDay } from "@/lib/microcms";
import {
  createImageContainer,
  createReplyTextContainer,
  fetchPostPermalink,
  publishContainer,
  waitForContainerReady,
} from "@/lib/threads";
import { CHANNEL_LABEL, dayPageUrl } from "@/lib/threads-channels";
import {
  getThreadsAccount,
  markThreadsPostFailed,
  markThreadsPostPublished,
  type ThreadsPost,
} from "@/lib/threads-db";

// Threads への実投稿。cron (予約時刻到来) と admin の「今すぐ投稿」の
// 両方から呼ばれる。呼び出し時点で row は status='publishing' に claim
// 済みであること (threads-db の claim 系関数を通す)。
//
// 投稿内容は行のチャンネルで決まる: threads-zh は passageZh (中文詩) +
// altZh、threads-ja は passageJa (日本語短歌) + altJa。どちらも写真付きで、
// そのチャンネルの言語のギャラリー URL を本体ポストへの返信でぶら下げる。
// 本文・alt は予約時ではなく投稿時点の最新を microCMS から読む
// (予約後の手直しを反映するため)。投稿した本文は posted_text に snapshot。

// Threads の画像上限 (8MB) を確実に下回るよう microCMS の画像 API で
// 変換した URL を渡す (対応形式は JPEG / PNG なので jpg 固定)。
const IMAGE_PARAMS = "?w=2048&fm=jpg&q=85";

export type PublishResult =
  | { ok: true; replyFailed: boolean }
  | { ok: false; error: string };

export async function publishThreadsPost(
  post: ThreadsPost,
): Promise<PublishResult> {
  try {
    const auth = await getThreadsAccount(post.channel);
    if (!auth) {
      throw new Error(
        `${CHANNEL_LABEL[post.channel]}アカウントが未接続です (Threads タブから接続)`,
      );
    }

    const day = await getDay(post.dayId);
    const isZh = post.channel === "threads-zh";
    const text = (isZh ? day.passageZh : day.passageJa)?.trim();
    if (!text) {
      throw new Error(`${isZh ? "passageZh" : "passageJa"} が未生成です`);
    }
    const altText = (isZh ? day.altZh : day.altJa)?.trim() || undefined;

    // 1. 写真 + 詩の本体ポスト
    const container = await createImageContainer(
      auth.threadsUserId,
      auth.accessToken,
      {
        imageUrl: `${day.image.url}${IMAGE_PARAMS}`,
        text,
        altText,
      },
    );
    await waitForContainerReady(container, auth.accessToken);
    const mediaId = await publishContainer(
      auth.threadsUserId,
      auth.accessToken,
      container,
    );
    const permalink = await fetchPostPermalink(mediaId, auth.accessToken).catch(
      () => null,
    );

    // 2. URL をリプライでぶら下げる。ここだけ失敗しても本体は公開済み
    //    なので published 扱いにし、error に注記を残す (ダッシュボードで
    //    分かるように)。
    let replyMediaId: string | null = null;
    let replyError: string | null = null;
    try {
      const replyContainer = await createReplyTextContainer(
        auth.threadsUserId,
        auth.accessToken,
        { text: dayPageUrl(post.channel, post.dayId), replyToId: mediaId },
      );
      await waitForContainerReady(replyContainer, auth.accessToken);
      replyMediaId = await publishContainer(
        auth.threadsUserId,
        auth.accessToken,
        replyContainer,
      );
    } catch (e) {
      console.error("[threads] URL reply failed", post.id, e);
      replyError = `URLリプライ失敗: ${e instanceof Error ? e.message : String(e)}`;
    }

    await markThreadsPostPublished(post.id, {
      postedText: text,
      threadsMediaId: mediaId,
      threadsPermalink: permalink,
      replyMediaId,
      error: replyError,
    });
    return { ok: true, replyFailed: replyError !== null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[threads] publish failed", post.id, e);
    await markThreadsPostFailed(post.id, message).catch((dbError) => {
      console.error("[threads] failed to record failure", dbError);
    });
    return { ok: false, error: message };
  }
}
