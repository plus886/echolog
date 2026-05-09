# echolog

オーナーのみが投稿可能で、閲覧は誰でもできる、個人用 Twitter クローン。echo（反響）+ log（記録）の合成語で、「自分の発信が積み重なっていく場所」をコンセプトにしたメモ的サービス。

## スタック

| レイヤー | 採用 |
|---|---|
| フレームワーク | Next.js 16（App Router）|
| ランタイム | Cloudflare Workers via OpenNext for Cloudflare |
| ストレージ（コンテンツ）| microCMS |
| 認証 | Cloudflare Access (Zero Trust) + アプリ側 JWT 検証 |
| ISR キャッシュ | Cloudflare R2（OpenNext incremental cache）|
| タグキャッシュ | Cloudflare D1（OpenNext tag cache）|
| 画像配信 | microCMS の画像 API（imgix）|
| スタイル | Tailwind CSS v4 |
| 文字数カウント | twitter-text（CJK 2倍カウント）|
| OGP 解析 | 自前パーサ（`lib/og-parse.ts`）|
| デプロイ CLI | Wrangler |

## 機能

- 公開フィード（`/feed`）と単体ビュー（`/tweets/[id]`）
- スレッド表示（セルフリプライ集約）
- リツイート（コメントなし RT / 引用 RT）
- 画像添付（最大 4 枚、microCMS メディアプロキシ経由）
- リンク本文の OGP プレビュー（compose 時）
- 認証付き管理画面（`/admin`、下書き、編集、削除）
- microCMS Webhook 受信（HMAC 検証）→ on-demand revalidate
- ポートフォリオへの埋め込み（`<TweetFeed />`）
- robots.txt / sitemap.xml / JSON-LD

## ドキュメント

- [docs/development.md](docs/development.md) — 開発手順・環境変数・本番デプロイ
- [docs/portfolio-integration.md](docs/portfolio-integration.md) — `<TweetFeed />` の埋め込み方
- [spec.md](spec.md) — 機能仕様
- [CLAUDE.md](CLAUDE.md) — Claude Code 用の開発プロンプト

## 主要コマンド

```bash
pnpm dev          # ローカル開発（Next.js dev server）
pnpm typecheck    # TypeScript チェック
pnpm lint         # ESLint
pnpm build        # Next.js ビルド（プリレンダリング検証）
pnpm cf:build     # OpenNext で Cloudflare 向けビルド
pnpm cf:deploy    # ビルド → wrangler deploy
```

## 構成

```
app/
├── (public)/          公開ビュー (/, /feed, /tweets/[id])
├── (admin)/           管理画面 (/admin/*)
├── api/
│   ├── tweets/        投稿/編集/削除
│   ├── revalidate/    microCMS Webhook 受信
│   ├── uploads/       画像アップロード
│   └── og-preview/    OGP 取得
├── robots.ts
├── sitemap.ts
└── error.tsx          グローバル error boundary
components/
├── feed/              TweetFeed, TweetCard
└── admin/             ComposeForm, EditForm, ImageUploader, LinkPreview, etc.
lib/
├── microcms.ts                読み取り（ISR キャッシュ）
├── microcms-management.ts     書き込み（管理 API）
├── access.ts                  Cloudflare Access JWT 検証
├── env.ts                     zod ベース環境変数
├── tweet-text.ts              twitter-text ラッパ
├── url-detect.ts / og-parse.ts  OGP 解析
└── format.ts / constants.ts
middleware.ts          Edge proxy（/admin/* /api/tweets/* /api/uploads /api/og-preview を保護）
```
