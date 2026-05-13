import { revalidatePath } from "next/cache";

// Tweet の create / update / delete (server action と API route と
// microCMS webhook) で揃って叩く revalidate path セット。
//
// 含むもの:
//  - `/`        : ホームの gallery (`listRootTweets`) に影響
//  - `/tweets/<id>` : 当該ツイートの詳細ページ (delete 時は強制 404 化のため
//                     有効、id 不明の webhook では skip)
//  - `/tweets/<refs.parent>`    : スレッド集約に影響するので親も refresh
//  - `/tweets/<refs.retweetOf>` : 引用元の被参照数 / refs 表示に影響しうるので
//                                 念のため
//  - `/admin`, `/admin/drafts` : compose 直下の Recent / Drafts 一覧
//
// 注意: `id` を optional にしているのは、microCMS webhook payload で
// tweetId が欠ける edge case (たまにある) でも安全に呼べるようにするため。
export function revalidateTweetPaths(
  id?: string,
  refs?: { parent?: string; retweetOf?: string },
) {
  revalidatePath("/");
  if (id) revalidatePath(`/tweets/${id}`);
  if (refs?.parent) revalidatePath(`/tweets/${refs.parent}`);
  if (refs?.retweetOf) revalidatePath(`/tweets/${refs.retweetOf}`);
  revalidatePath("/admin");
  revalidatePath("/admin/drafts");
}
