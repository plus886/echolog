// Astro SSR では Next.js の `revalidatePath()` 相当の API は無い。
// 旧コードでは microCMS write のたびにこれを呼んで関連 path の Next ISR
// cache を破棄していた (R2 incremental cache + D1 tag cache 経由)。
//
// Astro on Cloudflare では:
//  (a) 各 page route で Cache-Control: s-maxage=N で edge cache させて、
//      TTL 経過で自然に更新される
//  (b) 即時 invalidation が必要なら Cloudflare Cache API (`caches.default
//      .delete(url)`) で個別 path を purge する
//
// phase 3 の現時点では (a) (TTL 1 時間) で運用し、(b) は phase 6 (本番
// 切替) 時に sitemap-driven の purge job を実装する想定。本関数は API
// route 互換のため signature だけ揃えた no-op として残す。
//
// Tip: dev / build error を抑える意味でも no-op で十分。実装を入れたとき
// 呼び出し箇所を変更しないで済む。

export function revalidateTweetPaths(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _id?: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _refs?: { parent?: string; retweetOf?: string },
): void {
  // intentionally empty (see header)
}
