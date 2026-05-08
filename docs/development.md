# 開発手順

## 前提

- Node.js LTS（v20 / v22 推奨）
- pnpm
- microCMS のサービスドメインと API キー
- Cloudflare アカウント（本番デプロイ時）

## セットアップ

```bash
pnpm install
cp .env.example .env.local
```

`.env.local` を実値で埋める。

| 変数 | 用途 | Phase |
|---|---|---|
| `MICROCMS_SERVICE_DOMAIN` | `https://<x>.microcms.io` の `<x>` 部分 | 1 |
| `MICROCMS_API_KEY` | コンテンツ取得用 API キー | 1 |
| `MICROCMS_WEBHOOK_SECRET` | microCMS Webhook で設定するシークレット（自分で生成） | 1 |
| `MICROCMS_MANAGEMENT_API_KEY` | 投稿/編集/削除用。Service Key またはコンテンツ書き込み権限のキー | 2 |
| `CF_ACCESS_TEAM_DOMAIN` | 例 `yourteam.cloudflareaccess.com`（本番のみ） | 2 |
| `CF_ACCESS_AUD` | Access Application の AUD タグ（本番のみ） | 2 |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | 1 |
| `BYPASS_AUTH` | `true`（ローカル開発時のみ） | 2 |

## 通常開発（推奨）

```bash
pnpm dev
```

- http://localhost:3000 でトップページ
- http://localhost:3000/feed でリストビュー
- http://localhost:3000/tweets/[id] で単体ビュー
- http://localhost:3000/admin で投稿画面（`BYPASS_AUTH=true` のとき認証スキップ）
- http://localhost:3000/admin/drafts で下書き一覧
- http://localhost:3000/admin/edit/[id] で編集

`next dev` は OpenNext のビルドを通さず、Next.js の dev サーバで直接動作する。
ホットリロードが効くので普段はこちらで開発する。

## 認証（Cloudflare Access）

- 本番では `/admin/*`, `/api/tweets/*`, `/api/og-preview` を Cloudflare Access で保護する
- ローカルは `BYPASS_AUTH=true` かつ `NODE_ENV=development` のときに `proxy.ts` が認証を素通り
- 本番デプロイ時は Workers Secrets に `CF_ACCESS_TEAM_DOMAIN` と `CF_ACCESS_AUD` を登録
- `/api/revalidate` は Cloudflare Access の Bypass Policy 対象にする（HMAC 署名で検証）

## Cloudflare Workers ローカル実行（本番に近い環境）

```bash
pnpm cf:dev
```

`opennextjs-cloudflare build` でビルド → `wrangler dev` で実行。
R2 バインディング `NEXT_INC_CACHE_R2_BUCKET` のエミュレーションも含まれる。
本番の挙動を確認したいときに使う。

## ISR + Webhook の動作確認手順

1. microCMS の管理画面で対象 API（`tweets`）の Webhook を設定
   - URL: `https://<your-tunnel-or-ngrok-domain>/api/revalidate`
   - シークレット: `.env.local` の `MICROCMS_WEBHOOK_SECRET` と一致させる
2. ローカルでは `cloudflared tunnel` か `ngrok http 3000` などで一時的に外部公開
3. microCMS で `tweets` を編集 → 保存
4. 開発サーバのログに `revalidated: true` が出ることを確認
5. ブラウザを再読み込み → 反映を確認

ローカルで Webhook 検証だけテストしたい場合は curl で疑似リクエストを送れる:

```bash
SECRET="your-webhook-secret"
BODY='{"id":"abc123","type":"edit","contents":{"new":{"id":"abc123"}}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')
curl -X POST http://localhost:3000/api/revalidate \
  -H "Content-Type: application/json" \
  -H "X-MICROCMS-Signature: $SIG" \
  -d "$BODY"
```

## ビルド・型検査

```bash
pnpm typecheck   # TypeScript の型チェック
pnpm lint        # ESLint
pnpm cf:build    # OpenNext でのビルド（Cloudflare 向け）
```

## 本番デプロイ（Phase 1 では未実施）

Phase 2 で Cloudflare Access の設定後に実施する。
コマンドは以下を想定:

```bash
# シークレット登録（初回のみ）
pnpm wrangler secret put MICROCMS_API_KEY
pnpm wrangler secret put MICROCMS_WEBHOOK_SECRET
# ... 他の秘匿変数も同様

# R2 バケット作成（初回のみ）
pnpm wrangler r2 bucket create echolog-opennext-cache

# デプロイ
pnpm cf:deploy
```
