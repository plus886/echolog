# Migration Inventory — Next.js → Astro 6

このファイルはフェーズ 0 で作成する作業用台帳。MIGRATION_PLAN.md の表テンプレートに沿いつつ、本プロジェクト固有の事情を反映した形で記録する。

---

## ⚠️ 本プロジェクトのプラン例との根本的な差異

MIGRATION_PLAN.md の表 B 例は「D1 / R2 / KV にアプリ自身のデータがある」前提だが、**echolog はそうではない**:

- すべてのアプリデータ (tweets / images / portfolio gallery days) は **microCMS** にある (2 ワークスペース: `echolog` + `formosa-chiaroscuro`)
- 現状の Cloudflare bindings (R2: `echolog-opennext-cache`, D1: `echolog-tag-cache`) は **すべて OpenNext 内部キャッシュ専用** で、アプリの読み書きには登場しない
- 認証は **Cloudflare Access のエッジ JWT 検証**のみ。アプリ自身のセッションストア (KV) は存在しない

→ プラン §1-4 の「旧と同じ D1/R2/KV をそのまま引き継ぎ」は**完全に不要**。新 Astro Worker には**バインディングが 0 個**になる (ASSETS と Images binding は別途検討)。

---

## 表 A: ページ・ルート

| 旧パス                                 | 種類                  | 認証              | データ取得                                                                         | 主要 React 依存                                                                 | 新パス (Astro)                                     |
| -------------------------------------- | --------------------- | ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `app/layout.tsx`                       | ルート layout         | -                 | -                                                                                  | FontPlus script + Inter/Cormorant `next/font`                                   | `src/layouts/Root.astro`                           |
| `app/error.tsx`                        | グローバルエラー      | -                 | -                                                                                  | `"use client"` reset                                                            | `src/pages/500.astro` (任意)                       |
| `app/robots.ts`                        | robots metadata       | -                 | -                                                                                  | -                                                                               | `src/pages/robots.txt.ts`                          |
| `app/sitemap.ts`                       | sitemap metadata      | -                 | microCMS: listTweets                                                               | -                                                                               | `src/pages/sitemap.xml.ts`                         |
| `app/(public)/layout.tsx`              | 公開 layout (chrome)  | -                 | -                                                                                  | PortfolioNav / WordmarkLink / NavState (`"use client"`)                         | `src/layouts/Public.astro` + React Islands         |
| `app/(public)/page.tsx`                | ホーム (gallery)      | -                 | microCMS: loadGalleryDays + listRootTweets                                         | ScrollReveal / ScrollWordmark / GalleryParallax / ScrollMemory (`"use client"`) | `src/pages/index.astro` + 複数 Island              |
| `app/(public)/tweets/[id]/page.tsx`    | tweet 詳細            | -                 | microCMS: getTweet + listThreadReplies                                             | QuoteImages (`"use client"` — VT API lightbox), ReferenceCard (RSC)             | `src/pages/tweets/[id].astro` + QuoteImages Island |
| `app/(public)/tweets/[id]/loading.tsx` | suspense fallback     | -                 | -                                                                                  | -                                                                               | (Astro は不要 — SSR で同期描画)                    |
| `app/(public)/tweets/[id]/error.tsx`   | route error           | -                 | -                                                                                  | `"use client"` reset                                                            | `src/pages/tweets/[id]_error.astro` 検討           |
| `app/(admin)/admin/layout.tsx`         | admin layout          | 必須 (middleware) | `headers()` 経由でユーザ email                                                     | -                                                                               | `src/layouts/Admin.astro`                          |
| `app/(admin)/admin/page.tsx`           | compose + 最近        | 必須              | microCMS management API (listAdminTweets + getAdminTweet + listMyRetweetTargetIds) | ComposeForm / AdminTweetRow (`"use client"`, useActionState / useTransition)    | `src/pages/admin/index.astro` + Astro Action       |
| `app/(admin)/admin/drafts/page.tsx`    | drafts 一覧           | 必須              | microCMS: listAdminTweets (DRAFT)                                                  | AdminTweetRow Island                                                            | `src/pages/admin/drafts.astro`                     |
| `app/(admin)/admin/edit/[id]/page.tsx` | tweet 編集            | 必須              | microCMS: getAdminTweet                                                            | EditForm (`"use client"`, useTransition)                                        | `src/pages/admin/edit/[id].astro` + Astro Action   |
| `app/api/tweets/route.ts`              | POST create           | 必須 (middleware) | microCMS: createTweet                                                              | -                                                                               | `src/pages/api/tweets.ts`                          |
| `app/api/tweets/[id]/route.ts`         | PATCH/DELETE          | 必須              | microCMS: updateTweet / deleteTweet                                                | -                                                                               | `src/pages/api/tweets/[id].ts`                     |
| `app/api/uploads/route.ts`             | POST 画像アップロード | 必須              | microCMS uploadMedia                                                               | -                                                                               | `src/pages/api/uploads.ts`                         |
| `app/api/og-preview/route.ts`          | GET OGP 取得          | 必須              | 外部 fetch + lib/og-parse                                                          | -                                                                               | `src/pages/api/og-preview.ts`                      |
| `app/api/revalidate/route.ts`          | POST webhook (tweets) | HMAC              | revalidatePath                                                                     | -                                                                               | **削除** (Astro SSR では不要)                      |
| `app/api/revalidate/days/route.ts`     | POST webhook (days)   | HMAC              | revalidatePath                                                                     | -                                                                               | **削除**                                           |

**Server Actions** (`app/(admin)/admin/_actions.ts`, `"use server"`): publishTweetAction / saveDraftAction / updateTweetAction / deleteTweetAction / retweetAction — すべて microCMS management API → revalidateTweetPaths → redirect 構成。Astro Actions に書き換え (signature 差は `defineAction({ accept: 'form', input, handler })` パターン)。

**Client Components 一覧** (Astro での Island 候補):

- `transition-link.tsx` — `document.startViewTransition()` で wrap (RR v7 の `<Link viewTransition>` 相当を Astro `<ClientRouter />` で代替可)
- `wordmark-link.tsx` — TransitionLink wrap + scrollTo + sessionStorage clear
- `nav-state.tsx` — `usePathname()` 監視で `.is-scrolled` 制御
- `nav-ripple.tsx` — Char-by-char ripple animation (mouseenter / focus)
- `portfolio-nav.tsx` — mobile menu + matchMedia + ripple
- `scroll-wordmark.tsx` — scroll listener で `.is-scrolled` toggle
- `scroll-memory.tsx` — useLayoutEffect 復元 + scroll listener 保存 (sessionStorage)
- `scroll-reveal.tsx` — IntersectionObserver で `[data-reveal]` を `.is-revealed`
- `gallery-parallax.tsx` — scroll-driven transform on `[data-parallax]`
- `tweets/[id]/quote-images.tsx` — View Transitions API morph lightbox (flushSync 込み)
- `components/admin/ComposeForm.tsx`, `EditForm.tsx`, `AdminTweetRow.tsx`, `CharCounter.tsx`, `ImageUploader.tsx`, `LinkPreview.tsx` — admin UI 全般

---

## 表 B: Cloudflare バインディング

| バインディング名           | 種類          | リソース                                     | 用途                                 | 移行先                                                         |
| -------------------------- | ------------- | -------------------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `ASSETS`                   | static assets | `.open-next/assets` (OpenNext生成)           | OpenNext 静的アセット配信            | **置換**: Astro の `dist/` を `ASSETS` binding                 |
| `WORKER_SELF_REFERENCE`    | service       | self (echolog)                               | OpenNext 内部リダイレクト            | **削除**                                                       |
| `NEXT_INC_CACHE_R2_BUCKET` | R2            | `echolog-opennext-cache`                     | OpenNext ISR cache                   | **削除**                                                       |
| `echolog_opennext_cache`   | R2 (alias)    | (同上)                                       | (同上)                               | **削除**                                                       |
| `NEXT_TAG_CACHE_D1`        | D1            | `echolog-tag-cache` / `716c909d-...-cae97cf` | OpenNext tag cache                   | **削除**                                                       |
| `echolog_tag_cache`        | D1 (alias)    | (同上)                                       | (同上)                               | **削除**                                                       |
| `IMAGES`                   | images        | -                                            | OpenNext 画像最適化 (実コード未使用) | 検討: Astro `imageService: 'cloudflare'` で再利用するか / 削除 |

> 結論: **アプリデータ用のバインディングはゼロ**。新 wrangler.jsonc は `assets` だけ持つ最小構成になる (Cloudflare Image Resizing を使うなら `images` を残す)。

**compatibility_flags**:

- `nodejs_compat` — Astro でも一部使う可能性あり (jose や microcms-js-sdk が node 互換 API を踏むかどうか要検証)
- `global_fetch_strictly_public` — OpenNext 用、削除

---

## 表 C: 環境変数

> Astro では公開 prefix が `NEXT_PUBLIC_` → **`PUBLIC_`**。1 件該当。

| 変数名 (旧)                       | 変数名 (新)                                  | 用途                          | スコープ        | 保管                      |
| --------------------------------- | -------------------------------------------- | ----------------------------- | --------------- | ------------------------- |
| `MICROCMS_SERVICE_DOMAIN`         | 同じ                                         | echolog ワークスペース domain | server          | wrangler vars / .dev.vars |
| `MICROCMS_API_KEY`                | 同じ                                         | 読み取り API key              | server          | secret                    |
| `MICROCMS_MANAGEMENT_API_KEY`     | 同じ                                         | 書き込み API key              | server          | secret (optional)         |
| `MICROCMS_WEBHOOK_SECRET`         | 同じ                                         | HMAC signing                  | server          | secret                    |
| `FORMOSA_MICROCMS_SERVICE_DOMAIN` | 同じ                                         | gallery (formosa) workspace   | server          | vars                      |
| `FORMOSA_MICROCMS_API_KEY`        | 同じ                                         | (formosa) read key            | server          | secret                    |
| `FORMOSA_MICROCMS_WEBHOOK_SECRET` | 同じ                                         | (formosa) HMAC                | server          | secret                    |
| `CF_ACCESS_TEAM_DOMAIN`           | 同じ                                         | Access JWT issuer             | server          | vars (本番のみ)           |
| `CF_ACCESS_AUD`                   | 同じ                                         | Access AUD tag                | server          | vars (本番のみ)           |
| `NEXT_PUBLIC_SITE_URL`            | **`PUBLIC_SITE_URL`**                        | サイト URL                    | client + server | wrangler vars             |
| `BYPASS_AUTH`                     | 同じ                                         | dev 限定スキップ              | server          | .dev.vars のみ            |
| `NODE_ENV`                        | (Astro 自動: `import.meta.env.DEV` / `PROD`) | mode                          | server          | -                         |

---

## 削除候補ファイル (フェーズ 6 で旧プロジェクト退避時に処理)

```
.open-next/                       ← gitignore 済 (要確認)
.next/                            ← gitignore 済
open-next.config.ts               ← 不要
next.config.ts                    ← 不要 (initOpenNextCloudflareForDev 含む)
next-env.d.ts                     ← 不要
middleware.ts                     ← Astro middleware に再実装
migrations/                       ← D1 tag cache のマイグレーションのみ。アプリ無関係 → 削除
postcss.config.mjs                ← Astro で再評価 (Tailwind v4 構成)
eslint.config.mjs                 ← Astro 用に再構成
app/                              ← _legacy_nextjs/ へ退避
components/                       ← _legacy_nextjs/ へ退避 (admin だけ)
```

**保持するもの** (移植時にコピー先で利用):

```
lib/                              ← Drizzle ではないが、access / env / format / microcms / og-parse / tweet-text / url-detect / webhook / revalidate / use-iso-layout-effect / constants / gallery-compose / gallery-layout は流用可能
types/microcms.ts                 ← そのまま使える
public/                           ← Astro でも同名 (空のはず)
spec.md / README.md / CLAUDE.md   ← ドキュメント
```

---

## 最大の難所候補 (Top 3)

1. **クライアント側 choreography が緊密に結合している (View Transitions + scroll memory + nav slide + data-navigating flag)**
   - `transition-link.tsx` が `<html data-navigating="1">` を立て、`scroll-wordmark.tsx` がそれを読み、`scroll-memory.tsx` が useLayoutEffect で復元、`nav-state.tsx` が pathname を監視する四者の連携。
   - Astro `<ClientRouter />` は View Transitions を組み込みで提供するが、上記カスタムフラグの仕組みは Astro の遷移ライフサイクルイベント (`astro:before-swap`, `astro:after-swap`) で書き直す必要がある。
   - QuoteImages の lightbox morph は `flushSync` + `document.startViewTransition()` を**ページ遷移とは独立に**使うので、Astro Island 内で React と一緒に動くか要検証。

2. **FontPlus のサードパーティ DOM mutation × Astro hydration**
   - Next.js では FontPlus が hydration 前に inline style を注入し、textarea で hydration warning を出していた (`suppressHydrationWarning` で抑制)。
   - Astro の Island ベース hydration では、Server-rendered HTML と Island 部分の hydration タイミングが異なる。FontPlus の挙動と React Island の `useState` 持ち textarea が再びぶつかる可能性高し。Astro でも同じ対症療法が要る前提で。

3. **microCMS 入稿時の cache 無効化戦略の再設計**
   - 現状: webhook → `revalidatePath()` → Next ISR cache (OpenNext の R2/D1 経由) が無効化される
   - Astro SSR では「キャッシュ自体を持たない」のが標準。コンテンツの即時反映を取るか、Cloudflare edge cache + `Cache-Control: s-maxage=...` + `caches.default.delete()` で path-based purge を再実装するかの判断。
   - 旧 `revalidate = 3600` (ホーム / 詳細) のセマンティクスは喪失する。代替は HTTP cache header + webhook purge。

---

## メモ

- `.env.local` は **コミット禁止** (`.gitignore` で除外済を確認: 別途実施)
- `.dev.vars` への移植は wrangler dev で読まれる形式に変換が必要
- OpenNext 由来の `.open-next/` ディレクトリは別途 wrangler 切替時に削除
- 認証 (Cloudflare Access) は Astro middleware (`onRequest`) に移植。`lib/access.ts` の `verifyAccess` 関数はそのまま再利用可
