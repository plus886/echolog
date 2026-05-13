# Next.js → Astro 移行プラン (Cloudflare デプロイ・決定版)

> **前提**: Next.js App Router + OpenNext (`@opennextjs/cloudflare`) + D1 / R2 / KV から、
> Astro 6 SSR + `@astrojs/cloudflare` + 同じ D1 / R2 / KV へ移行する。
> 既存の React コンポーネントは **Astro ネイティブ (.astro) にクリーン書き直し**。
> このファイルはリポジトリルートに置き、Claude Code に対する**正規の作業指示書**として使う。

---

## 📜 Claude Code が必ず守るルール

1. **フェーズ 0 から順に実行する。番号を飛ばさない。**
2. 各フェーズ末の **✅ チェックポイント** で必ず停止し、ユーザーに報告して承認を待つ。
3. 不明点・曖昧な点は推測で進めず、必ずユーザーに質問する。
4. **旧 Next.js コードは削除しない**。新 Astro プロジェクトを並行ディレクトリで構築し、最後にスワップする。
5. git commit はフェーズ単位で区切る。1コミット = 1フェーズの完了を原則とする。
6. シークレット (D1 ID, API キー等) を **チャットログに平文で出さない**。報告時はマスクする。
7. `.dev.vars`, `.env*`, `.open-next/` は絶対にコミットしない。

---

## 🌱 環境要件チェック (フェーズ前の最初の作業)

```bash
node -v        # 22.x 以上であること (Astro 6 必須要件)
npm -v
git status     # クリーンであること
git rev-parse --abbrev-ref HEAD   # 現在のブランチ確認
```

Node が 22 未満なら、nvm/volta 等で切り替えてから着手。報告のみ行いユーザー判断を仰ぐ。

---

## フェーズ 0: 現状把握(読むだけ・変更禁止)

このフェーズで**いかなるファイルも変更してはいけない**。

### 0-1. 既存プロジェクト構造の取得

```bash
git checkout -b migrate/astro
ls -la
cat package.json
cat wrangler.jsonc 2>/dev/null || cat wrangler.toml
cat open-next.config.ts 2>/dev/null
cat next.config.* 2>/dev/null
cat tsconfig.json
ls -la src/app 2>/dev/null || ls -la app
ls -la src/middleware.ts 2>/dev/null || ls -la middleware.ts 2>/dev/null
```

### 0-2. インベントリ作成

リポジトリルートに **`MIGRATION_INVENTORY.md`** を新規作成し、以下の3表を埋める。

#### 表A: ページ・ルート

```markdown
| 旧パス | 種類 | 認証 | データ取得 | 主要React依存 | 新パス (Astro) |
|---|---|---|---|---|---|
| app/page.tsx | 公開トップ | 不要 | D1: posts list | - | src/pages/index.astro |
| app/posts/[slug]/page.tsx | 公開・動的 | 不要 | D1: post detail | MDXコンポーネント | src/pages/posts/[slug].astro |
| app/admin/page.tsx | 管理ダッシュボード | 必須 | D1: drafts | TipTap, 自作Form | src/pages/admin/index.astro |
| app/admin/posts/new/page.tsx | 新規投稿 | 必須 | - | TipTap, R2アップロード | src/pages/admin/posts/new.astro |
| app/api/posts/route.ts | API | - | D1: write | - | src/pages/api/posts.ts |
| app/api/auth/[...all]/route.ts | Better Auth | - | KV: session | - | src/pages/api/auth/[...all].ts |
| app/api/upload/route.ts | R2 直アップ | 必須 | R2: PUT | - | src/pages/api/upload.ts |
```

#### 表B: Cloudflare バインディング

```markdown
| バインディング名 | 種類 | リソース名/ID | 用途 | 移行先での扱い |
|---|---|---|---|---|
| DB | D1 | <db-name> / <UUID> | 投稿・ユーザー | そのまま引き継ぎ |
| MEDIA | R2 | <bucket-name> | 画像・添付 | そのまま引き継ぎ |
| SESSIONS | KV | <namespace-id> | セッション | そのまま引き継ぎ |
| NEXT_INC_CACHE_R2_BUCKET | R2 | <bucket> | **OpenNext専用キャッシュ** | **不要・削除** |
| NEXT_CACHE_WORKERS_KV | KV | <namespace> | **OpenNext専用キャッシュ** | **不要・削除** |
| WORKER_SELF_REFERENCE | service | self | **OpenNext専用** | **不要・削除** |
| IMAGES | images | - | OpenNext画像最適化 | Astro `astro:assets` に置換 |
```

> ⚠️ ID/UUIDは**実値をMIGRATION_INVENTORY.mdに書いてもよい**(リポジトリは秘匿前提)。
> ただしチャットで報告するときはマスク (`<UUID>`)。

#### 表C: 環境変数

```markdown
| 変数名 | 用途 | スコープ | 値 |
|---|---|---|---|
| BETTER_AUTH_SECRET | 認証署名 | server | (.dev.vars / secret) |
| NEXT_PUBLIC_SITE_URL | サイトURL | client | (vars) → `PUBLIC_SITE_URL` に改名 |
| ... | | | |
```

> Astro では公開変数の prefix が `NEXT_PUBLIC_` ではなく **`PUBLIC_`**。移行時に全置換が必要。

### 0-3. 削除候補ファイルのリスト化

OpenNext 由来のファイルは Astro では全て不要:

```
.open-next/                    ← gitignore済みのはず
open-next.config.ts            ← 不要
next.config.ts (or .mjs/.js)   ← 不要 (initOpenNextCloudflareForDev呼び出し含む)
next-env.d.ts                  ← 不要
.next/                         ← 不要
public/_headers (OpenNext生成分のみ) ← Astro再設計
cloudflare-env.d.ts            ← Astroで自動生成し直す
```

### ✅ チェックポイント 0

ユーザーに以下を報告:
1. ルーター: App Router 確認済み
2. デプロイ: OpenNext (`@opennextjs/cloudflare` v<X.Y.Z>) 確認済み
3. `MIGRATION_INVENTORY.md` の **行数のみ**を報告 (中身全文は出さない)
4. **最大の難所候補** を1〜3個挙げる (例: middleware が複雑、Server Action 多用、外部API依存等)
5. Node バージョン

→ ユーザーの「進めて」を受けるまで停止。

---

## フェーズ 1: 並行 Astro プロジェクトの初期化

**重要**: 旧プロジェクトの**サブディレクトリではなく、隣のディレクトリ**に作る。
ただし git は旧プロジェクトのリポジトリ内で一元管理する戦略。

### 1-1. 構造方針

```
my-blog/                    ← Gitリポジトリのルート(旧Next.jsプロジェクト)
├── (既存のNext.jsファイル群)
├── MIGRATION_PLAN.md       ← この文書
├── MIGRATION_INVENTORY.md  ← フェーズ0で作成
└── _astro/                 ← ★ 新規。Astroプロジェクトを一時的にここに置く
    ├── src/
    ├── package.json
    └── wrangler.jsonc
```

最終フェーズで `_astro/` の中身をルートに引き上げて旧Next.jsファイルを退避させる。

### 1-2. Astro プロジェクト作成

```bash
cd <リポジトリルート>
npm create cloudflare@latest _astro -- --framework=astro
```

プロンプト:
- Rendering: **server (SSR)**
- TypeScript: **Yes (strict 推奨)**
- Git: **No** (親リポジトリで管理するため)
- Deploy now: **No**

### 1-3. 統合パッケージのインストール

```bash
cd _astro
npx astro add react      # 管理画面の TipTap で必要なため
npx astro add tailwind   # 旧プロジェクトで Tailwind 使用前提
```

その他 (旧プロジェクトと同バージョンを揃える):

```bash
npm install drizzle-orm better-auth
npm install -D drizzle-kit
# 管理画面のエディタを使う場合
npm install @tiptap/core @tiptap/starter-kit @tiptap/react
```

### 1-4. wrangler.jsonc のセットアップ

`_astro/wrangler.jsonc` を以下に上書き。**ID は MIGRATION_INVENTORY.md 表Bからコピー**。

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "<旧と同じworker名>",
  "main": "./dist/_worker.js/index.js",
  "compatibility_date": "2026-05-13",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist"
  },
  "observability": { "enabled": true },

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "<旧DB名>",
      "database_id": "<旧UUID>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "MEDIA",
      "bucket_name": "<旧バケット名>"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "SESSIONS",
      "id": "<旧KV ID>"
    }
  ]
}
```

> 🚫 **削除して持ち込まないバインディング**:
> `NEXT_INC_CACHE_R2_BUCKET`, `NEXT_CACHE_WORKERS_KV`, `WORKER_SELF_REFERENCE`, `IMAGES`,
> `global_fetch_strictly_public` フラグも不要。

### 1-5. 型生成

```bash
npx wrangler types --env-interface CloudflareEnv worker-configuration.d.ts
```

これで `context.locals.runtime.env.DB` などが型安全になる。

### 1-6. astro.config.mjs

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',  // CloudflareのImage Resizingを使う場合
  }),
  integrations: [react(), tailwind()],
});
```

### ✅ チェックポイント 1

```bash
cd _astro
npm run dev   # Astro デフォルトページが localhost:4321 で開く
```

開けることを確認 → ユーザー報告 → 承認を受けて次へ。

---

## フェーズ 2: 共通基盤の移植 (DB / 認証 / middleware)

### 2-1. tsconfig path alias の継承

旧 `tsconfig.json` の `paths` ( 例: `"@/*": ["./src/*"]` ) を新側にも設定。
これで import パスをほぼ変えずに済む。

### 2-2. Drizzle スキーマ移植

旧 `src/db/schema.ts` (またはそれに相当するファイル) を **`_astro/src/lib/schema.ts`** にコピー。
内容は変更不要(Drizzle のスキーマは framework agnostic)。

### 2-3. DB クライアントを Astro 流に書き換え

**旧コード (OpenNext)**:
```ts
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
export function getDb() {
  return drizzle(getCloudflareContext().env.DB);
}
```

**新コード (Astro)**:
```ts
// _astro/src/lib/db.ts
import { drizzle } from 'drizzle-orm/d1';
import type { APIContext } from 'astro';
import * as schema from './schema';

export function getDb(context: APIContext | { locals: App.Locals }) {
  return drizzle(context.locals.runtime.env.DB, { schema });
}
```

> ⚠️ `getCloudflareContext()` をグローバルに呼ぶパターンが Astro では使えない。
> **必ず page / endpoint の `Astro` または `context` 経由で渡す**こと。

`_astro/src/env.d.ts` に型補強:
```ts
/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;
declare namespace App {
  interface Locals extends Runtime {
    user?: { id: string; email: string };
  }
}
```

### 2-4. Better Auth の移植

旧 `src/lib/auth.ts` をコピーし、**handler のエクスポートだけ書き換え**:

旧 `app/api/auth/[...all]/route.ts`:
```ts
import { auth } from '@/lib/auth';
export const { GET, POST } = auth.handler;
```

新 `_astro/src/pages/api/auth/[...all].ts`:
```ts
import type { APIRoute } from 'astro';
import { auth } from '../../../lib/auth';

export const ALL: APIRoute = async ({ request }) => {
  return auth.handler(request);
};

export const prerender = false;
```

> 重要: `/api/*` 配下は **必ず `export const prerender = false`** を付ける。
> Astro はデフォで static試行するため、SSRさせる宣言が要る。

### 2-5. middleware の移植

旧 `middleware.ts` の matcher 設定を Astro の onRequest に翻訳。

```ts
// _astro/src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname.startsWith('/admin')) {
    const session = await auth.api.getSession({ headers: context.request.headers });
    if (!session) {
      return context.redirect('/login');
    }
    context.locals.user = session.user;
  }
  return next();
});
```

### 2-6. Drizzle マイグレーション運用

旧プロジェクトの `drizzle.config.ts` をコピー。**マイグレーションは新規発行せず**、既存DBのスキーマをそのまま使う。

```bash
# 動作確認だけ
npx wrangler d1 execute <db-name> --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### ✅ チェックポイント 2

- `/api/auth/session` が応答することをローカル確認
- D1 への読み取りクエリがエンドポイントから通ることを確認 (`/api/test` のような一時エンドポイントで OK・確認後に削除)

---

## フェーズ 3: ページの段階的書き直し

**1ページずつ**移植 → 動作確認 → コミット。一気にやらない。
書き直し順は **影響範囲が小さい順**:

1. 静的に近い公開ページ (about, privacy)
2. 記事一覧 (D1 読み取りのみ)
3. 記事詳細 (動的ルート)
4. API ルート (POST 系含む)
5. 管理画面 (最後)

### 3-1. App Router → Astro 変換パターン

#### サーバーコンポーネント (公開ページ)

**旧**:
```tsx
// app/posts/[slug]/page.tsx
import { getDb } from '@/lib/db';

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const post = await db.query.posts.findFirst({ where: (p, { eq }) => eq(p.slug, slug) });
  if (!post) notFound();
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.body }} />
    </article>
  );
}
```

**新**:
```astro
---
// _astro/src/pages/posts/[slug].astro
import Layout from '../../layouts/Base.astro';
import { getDb } from '../../lib/db';
import { eq } from 'drizzle-orm';
import { posts } from '../../lib/schema';

export const prerender = false;

const { slug } = Astro.params;
if (!slug) return Astro.redirect('/404');

const db = getDb(Astro);
const post = await db.query.posts.findFirst({ where: eq(posts.slug, slug) });
if (!post) return Astro.redirect('/404');
---
<Layout title={post.title}>
  <article>
    <h1>{post.title}</h1>
    <div set:html={post.body} />
  </article>
</Layout>
```

#### Server Action → Astro Actions

**旧**:
```ts
// app/admin/posts/new/actions.ts
'use server';
import { getDb } from '@/lib/db';
import { redirect } from 'next/navigation';

export async function createPost(formData: FormData) {
  const db = getDb();
  await db.insert(posts).values({ title: formData.get('title') as string, ... });
  redirect('/admin');
}
```

**新**:
```ts
// _astro/src/actions/index.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { getDb } from '../lib/db';
import { posts } from '../lib/schema';

export const server = {
  createPost: defineAction({
    accept: 'form',
    input: z.object({
      title: z.string().min(1),
      body: z.string(),
    }),
    handler: async ({ title, body }, context) => {
      const db = getDb(context);
      const [post] = await db.insert(posts).values({ title, body, slug: slugify(title) }).returning();
      return { postId: post.id };
    },
  }),
};
```

呼び出し側 (Astro ページ):
```astro
---
import { actions } from 'astro:actions';
const result = Astro.getActionResult(actions.createPost);
if (result && !result.error) return Astro.redirect('/admin');
---
<form method="POST" action={actions.createPost}>
  <input name="title" />
  <textarea name="body" />
  <button>投稿</button>
</form>
```

#### API ルート

**旧**:
```ts
// app/api/posts/route.ts
export async function GET() {
  const db = getDb();
  const list = await db.query.posts.findMany();
  return Response.json(list);
}
```

**新**:
```ts
// _astro/src/pages/api/posts.ts
import type { APIRoute } from 'astro';
import { getDb } from '../../lib/db';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const db = getDb(context);
  const list = await db.query.posts.findMany();
  return new Response(JSON.stringify(list), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

### 3-2. Next.js 固有 API の置換早見

| Next.js | Astro |
|---|---|
| `import Link from 'next/link'` | `<a href="...">` |
| `<Image>` from `next/image` | `import { Image } from 'astro:assets'` |
| `useRouter()` | `Astro.url` (サーバー) / `window.location` (クライアント) |
| `useSearchParams()` | `Astro.url.searchParams` |
| `cookies()` from `next/headers` | `Astro.cookies` |
| `headers()` from `next/headers` | `Astro.request.headers` |
| `redirect()` | `Astro.redirect()` |
| `notFound()` | `Astro.redirect('/404')` or `return new Response(null, { status: 404 })` |
| `generateMetadata` | Layout の `<head>` に直接 |
| `revalidatePath` | (不要・SSRなので即反映) |
| `'use client'` | `client:load` などのディレクティブ |

### 3-3. クライアント側JSが必要な場合

管理画面のエディタなどは **React コンポーネントを残してIsland化** ではなく、
**今回はクリーン書き直し方針**なので、まず以下を検討:

1. **Astro + 素のフォーム + Astro Actions で済むか?** → 多くは Yes
2. リアルタイムプレビューやリッチエディタが必須 → TipTap (React) を Island として `client:load`

リッチエディタが要る場合のみ、`_astro/src/components/Editor.tsx` を React として実装し、ページで:

```astro
---
import Editor from '../components/Editor.tsx';
---
<Editor client:load initialValue={post?.body ?? ''} />
```

### ✅ 各ページ移植後のチェック

- そのページが想定通り表示される
- 旧Next.jsで送られていたJSバンドルサイズ vs 新Astroでのサイズを Network タブで比較し、概数を報告
- `git commit -m "migrate: page <name>"` でコミット

すべてのページが移植完了したらフェーズ全体の **✅ チェックポイント 3** で報告。

---

## フェーズ 4: スタイル・アセット・SEO

### 4-1. Tailwind
- 旧 `tailwind.config.{js,ts}` を新側にコピー
- `content` パスを `['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}']` に修正
- グローバルCSSは `_astro/src/styles/global.css` に集約

### 4-2. フォント
- `next/font` を使っていた場合は `@fontsource/<name>` パッケージ or `<link>` 直書きへ
- セルフホスト派なら `public/fonts/` に置いて `@font-face`

### 4-3. メタタグ
旧 `generateMetadata` を **Layout 内で `<head>` に直書き**:

```astro
---
// _astro/src/layouts/Base.astro
interface Props { title: string; description?: string; ogImage?: string; }
const { title, description, ogImage } = Astro.props;
---
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
    {description && <meta name="description" content={description} />}
    {ogImage && <meta property="og:image" content={ogImage} />}
  </head>
  <body><slot /></body>
</html>
```

### 4-4. 画像
- 旧 `<Image>` を `import { Image } from 'astro:assets'` に置換
- R2 にある画像は外部URLとして渡すか、Cloudflare Image Resizing バインディング経由で最適化

---

## フェーズ 5: View Transitions (任意・装飾)

ベース Layout に1行追加するだけ:

```astro
---
import { ClientRouter } from 'astro:transitions';
---
<head>
  <ClientRouter />
</head>
```

これで全ページ遷移が SPA 風になる。

---

## フェーズ 6: 旧→新の入れ替えとデプロイ

### 6-1. ローカル本番ビルド確認

```bash
cd _astro
npm run build
npx wrangler dev   # workerd runtime で確認
```

ここで全主要ページを目視確認。

### 6-2. *.workers.dev でプレビューデプロイ

`wrangler.jsonc` の `name` を **一時的に別名** (例: `my-blog-astro-preview`) に変更:

```bash
npx wrangler deploy
```

`<name>.workers.dev` で動作確認。D1/R2/KV のデータは旧と共有なので、書き込みテストは要注意。

### 6-3. ファイルのスワップ

プレビューで問題なければ:

```bash
cd <リポジトリルート>

# 旧Next.jsファイルを退避
mkdir _legacy_nextjs
git mv app _legacy_nextjs/ 2>/dev/null || mv app _legacy_nextjs/
git mv next.config.* _legacy_nextjs/ 2>/dev/null
git mv open-next.config.ts _legacy_nextjs/ 2>/dev/null
git mv middleware.ts _legacy_nextjs/ 2>/dev/null

# _astro の中身をルートに移動
mv _astro/* .
mv _astro/.* . 2>/dev/null   # 隠しファイル
rmdir _astro

# package.json の scripts を確認
cat package.json
```

`wrangler.jsonc` の `name` を **本番名に戻す**。

### 6-4. 本番デプロイ

```bash
npm run build
npx wrangler deploy
```

カスタムドメインが旧Workerに紐づいている場合、Cloudflare ダッシュボードから新Workerに付け替え。

### 6-5. アーカイブと掃除

1週間運用して問題なければ:
- `_legacy_nextjs/` を削除 → `git rm -r _legacy_nextjs && git commit -m "chore: remove legacy nextjs"`
- 不要パッケージを `package.json` から削除: `next`, `@opennextjs/cloudflare`, `react-dom` (React Island使ってなければ)
- `npm prune` でnode_modules整理

---

## 🚨 ハマりやすい地雷リスト

| # | 症状 | 原因 | 対処 |
|---|---|---|---|
| 1 | `process.env.X` が undefined | Cloudflare Workers では `process.env` なし | `context.locals.runtime.env.X` か `import.meta.env.X` (公開変数のみ) |
| 2 | `NEXT_PUBLIC_*` 変数が読めない | Astro のクライアント公開 prefix は `PUBLIC_` | 全置換 |
| 3 | `/api/*` がプリレンダされて 405 | Astro のデフォルト動作 | 各 endpoint に `export const prerender = false` |
| 4 | `getCloudflareContext()` グローバル呼出が動かない | OpenNext 固有 API | `Astro.locals.runtime.env` に書き換え |
| 5 | 画像が壊れる | `next/image` の loader 設定が消えた | `astro:assets` + 必要なら Cloudflare Images バインディング再設定 |
| 6 | フォーム送信で CSRF エラー | Astro Actions は Origin チェックあり | `astro.config.mjs` で `security.checkOrigin` を確認 |
| 7 | `params` が Promise でない | App Router の async params の名残 | `await Astro.params` は不要、同期で取れる |
| 8 | ローカルでバインディングが見つからない | `wrangler dev` ではなく `astro dev` を使うと型は通るがバインディング未注入のことがある | `astro dev` でも Cloudflare adapter のおかげで使えるが、本番相当の挙動を見たい時は `wrangler dev` で `dist/` を見る |
| 9 | デプロイ後 500 | `dist/_worker.js/index.js` が見つからない | `npm run build` を deploy 前に必ず実行。CI なら build ステップを分離 |
| 10 | KV セッションが切れる | OpenNext と Astro で KV キー prefix が違う | 既存セッションは無効になる前提。再ログイン必須を周知 |

---

## ✅ Definition of Done

- [ ] ローカル `npm run dev` で旧Next.js版と同等以上の全ページ表示
- [ ] `/admin` 配下が認証で保護されている
- [ ] 投稿の CRUD が新管理画面で完結し、D1 に反映される
- [ ] 画像アップロードが R2 に保存され、公開ページで表示される
- [ ] Lighthouse Performance (モバイル) が **旧版より10ポイント以上向上**
- [ ] 公開ページで送信される JS が **旧版の50%以下**
- [ ] `npx wrangler deploy` 成功
- [ ] 本番ドメインで全機能動作確認
- [ ] OpenNext 関連の依存・設定ファイルが完全に削除されている
- [ ] `_legacy_nextjs/` を最終的に削除

---

## 🤖 Claude Code への起動プロンプト (コピペ用)

```
このリポジトリを Next.js App Router + OpenNext + Cloudflare から
Astro 6 SSR + @astrojs/cloudflare に移行します。

作業指示書: MIGRATION_PLAN.md

ルール:
1. フェーズ 0 から順番に実行する。番号を飛ばさない
2. 各フェーズの「✅ チェックポイント」で必ず止まり、私に報告してから次へ
3. 不明点は推測せず質問する
4. 旧 Next.js コードは削除せず、_astro/ ディレクトリに新規構築する並行戦略
5. シークレット類は報告時にマスクする
6. git commit はフェーズ単位

まずフェーズ 0 から開始してください。
最初のアクションは MIGRATION_PLAN.md の冒頭ルールと環境要件チェックの読み上げと、
git ブランチ migrate/astro の作成です。
```
