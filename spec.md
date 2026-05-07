# 個人Twitterクローン 仕様書

## 1. プロジェクト概要

オーナー（あなた）のみが投稿可能で、閲覧は誰でも可能なTwitterクローン。ポートフォリオサイトと統合し、メモ感覚で気軽に投稿しつつ、外部SNSで個別ツイートをシェア可能な仕組みを提供する。

### 1.1 構成するビュー

| ビュー | アクセス権 | 用途 |
|---|---|---|
| 管理・投稿画面 | オーナーのみ（認証） | ツイートの投稿・編集・削除、下書き管理 |
| リストビュー | 誰でも | ポートフォリオサイトに埋め込み、最新ツイートを時系列表示 |
| 単体ビュー | 誰でも | ユニークURLからアクセスされた個別ツイート、SNSシェア用 |

---

## 2. 技術選定

### 2.1 採用スタック

| レイヤー | 採用技術 | 理由 |
|---|---|---|
| フレームワーク | Next.js 15+ (App Router) | 公開側と管理画面を1リポジトリで完結。ISRでmicroCMS Webhook連携が自然 |
| Cloudflareアダプター | OpenNext for Cloudflare (`@opennextjs/cloudflare`) | Cloudflare Workers上でNext.jsを動作させる。Node.js互換性が高くISRもサポート |
| バックエンド | microCMS | 要件として確定 |
| 認証 | Cloudflare Access (Zero Trust) | エッジで認証ゲートを実現。アプリ内に認証コードを書かずに済む |
| ホスティング | Cloudflare Workers (via Pages) | オーナーが既にCloudflareエコシステムを利用中 |
| 画像配信 | microCMSの画像API（imgix） | 別途ストレージ不要、リサイズ・最適化込み |
| キャッシュストレージ | Cloudflare KV または R2 | OpenNextがISRキャッシュ用に利用 |
| スタイリング | Tailwind CSS | 個人開発の生産性重視 |
| OG情報取得 | open-graph-scraper 等のサーバーサイドライブラリ | リンクのOGP展開用 |
| 日付処理 | date-fns | 軽量、必要分だけインポート可能 |
| デプロイCLI | Wrangler | Cloudflare公式CLI |

### 2.2 構成図

```
                   ┌──────────────────────────────┐
                   │   Cloudflare Access           │
                   │  /admin/* へのリクエストを    │
                   │   エッジで認証ゲートする       │
                   └──────────┬───────────────────┘
                              │ 認証通過後のみ
                              ▼
┌─────────────────────────────────────────────────┐
│       Cloudflare Workers (Next.js via OpenNext) │
│                                                 │
│  ┌─────────────┐    ┌──────────────────┐        │
│  │ (public)    │    │ (admin)          │        │
│  │  /          │    │  /admin          │        │
│  │  /tweets/*  │    │  Access保護       │        │
│  │  /feed      │    │                  │        │
│  └─────────────┘    └──────────────────┘        │
│         │                    │                  │
│         │ ISR (KV/R2)        │ Server Actions   │
│         ▼                    ▼                  │
└─────────┼────────────────────┼──────────────────┘
          │                    │
          │   ┌────────────────┘
          │   │ Webhook (revalidate)
          ▼   ▼
    ┌──────────────────┐
    │    microCMS      │
    │  (tweets, drafts,│
    │   images)        │
    └──────────────────┘
```

### 2.3 Cloudflare Access の構成

- **Application**: 自サイトのドメイン全体を登録
- **Policy**:
  - `/admin/*` および `/api/tweets/*` `/api/og-preview` 等の管理系エンドポイントを保護対象パスとして指定
  - 公開側パス（`/`, `/feed`, `/tweets/*`, `/api/revalidate` など）は **Bypass Policy** で素通しに設定
  - 認証方式: GitHub OAuth または メール OTP（自分のメールアドレスのみ許可）
- **Access Application Audience (AUD) Tag**: アプリ側でJWT検証する際の識別子
- **Service Tokens**: microCMSからのWebhook受信エンドポイント（`/api/revalidate`）はAccessをBypassし、別途HMAC署名で検証

### 2.4 ローカル開発時の認証

Cloudflare Access は本番ドメインに対して効くため、ローカルでは別の仕組みが必要:

- 環境変数 `BYPASS_AUTH=true` をローカルでのみ設定
- Middleware内で `BYPASS_AUTH === 'true'` かつ `NODE_ENV === 'development'` の場合のみ認証チェックを素通り
- 本番では絶対にこの環境変数を設定しない（万一に備え、NODE_ENV と AND条件 にする）

---

## 3. データモデル（microCMS）

### 3.1 API: `tweets`

| フィールド名 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | text (auto) | ◯ | microCMS自動生成のランダム文字列。これがユニークURLのslugになる |
| `body` | textArea | - | 本文。引用RT以外は必須。最大280文字（CJKは2倍カウント） |
| `images` | image[] | - | 添付画像。0〜4枚（Twitter準拠） |
| `parent` | content reference (self) | - | セルフリプライ時の親ツイート参照。未設定なら新規スレッド |
| `retweetOf` | content reference (self) | - | リツイート/引用RT時の参照先 |
| `retweetType` | select | - | `retweet`（コメントなしRT）/ `quote`（引用RT）。`retweetOf`が設定されている時のみ有効 |
| `publishedAt` | date | ◯ | microCMS標準フィールド。投稿日時 |
| `revisedAt` | date | ◯ | microCMS標準フィールド。最終編集日時 |

**補足:**
- 下書き機能はmicroCMS標準の「下書き」状態を活用する（独自実装不要）
- 文字数制限はTwitter準拠（日本語等CJK 140 / ASCII 280相当）。設定値は`lib/constants.ts`に定義し変更容易にする
- `body`の必須性:
  - 通常投稿・セルフリプライ・引用RT(`quote`): **必須**
  - コメントなしRT(`retweet`): **任意**（空でよい）
- バリデーション: `parent`と`retweetOf`は同時に設定不可（リプライとRTは排他）

### 3.2 文字数カウントの仕様

Twitter準拠（実質的にtwitter-text相当の挙動）で実装:

- **CJK文字（日本語、中国語、韓国語、ハングル、絵文字等の全角文字）: 1文字 = 2カウント**
- **ASCII文字（半角英数字・記号）: 1文字 = 1カウント**
- URL: 短縮表示せず実文字数でカウント（簡潔さ優先）
- 上限: **280カウント**（純日本語なら実質140文字、純英語なら280文字）
- 入力中はリアルタイムでカウント値を表示。残り20以下で黄色、超過で赤
- 超過時は投稿ボタンを無効化

**実装方針:**
- 公式の `twitter-text` パッケージを採用するか、自前で簡易実装するかは要検討
- `twitter-text` は実績があるが依存が増える。自前実装の場合は Unicode の East Asian Width プロパティを参照して全角/半角を判定
- 投稿ボタンの活性制御に必要なのでクライアント側で動作する必要がある

---

## 4. ルーティング

### 4.1 公開側

| パス | レンダリング | 内容 |
|---|---|---|
| `/` | SSG | ポートフォリオトップ |
| `/feed` | ISR (revalidate: on-demand) | リストビュー単体ページ。ポートフォリオへの埋め込み元 |
| `/tweets/[id]` | ISR (revalidate: on-demand) | 単体ビュー。スレッド全体を表示 |

### 4.2 管理側

| パス | 内容 |
|---|---|
| `/admin` | 投稿画面（一覧 + 新規投稿フォーム） |
| `/admin/edit/[id]` | 編集画面 |
| `/admin/drafts` | 下書き一覧 |

### 4.3 API Routes

| パス | メソッド | 用途 | Access保護 |
|---|---|---|---|
| `/api/tweets` | POST | 新規投稿 | あり |
| `/api/tweets/[id]` | PATCH, DELETE | 編集・削除 | あり |
| `/api/revalidate` | POST | microCMS Webhookエンドポイント。`/feed`と該当`/tweets/[id]`を再検証 | なし（HMAC署名で検証） |
| `/api/og-preview` | GET | URL受け取り→OGP情報を返す。クライアントから本文プレビュー時に使用 | あり |

Cloudflare Access の Application Policy で、`/admin/*` および `/api/tweets/*`、`/api/og-preview` を保護対象に設定。`/api/revalidate` は Bypass Policy で素通しにする。

---

## 5. 各ビューの詳細仕様

### 5.1 リストビュー (`/feed` および埋め込み)

**表示:**
- 最新順（`publishedAt`降順）
- セルフリプライは表示せず、**親ツイート（=スレッドの起点）のみ**を表示
- リツイートは以下のように表示:
  - **コメントなしRT**: 「🔁 自分がリツイート」のラベル付きで元ツイートを表示。元ツイートの`publishedAt`ではなく**RTした日時**で並び替え
  - **引用RT**: 自分のコメント本文を上部に表示し、その下に元ツイートを引用カードとして埋め込み
- スレッドが存在するツイートには「スレッドを表示 →」リンクを追加し、単体ビューへ遷移
- 1ツイートのカード内: 本文、添付画像、投稿日時、単体ビューへのリンク

**ページネーション:**
- 初期表示20件、「もっと見る」ボタンでクライアント側追加読み込み
- 初回はサーバーサイドで取得（SEO対策）

**ポートフォリオサイトへの埋め込み:**
- 同一Next.jsプロジェクト内なので**Reactコンポーネントとして直接import**できる
- `<TweetFeed limit={5} />`のような形でポートフォリオの任意ページに配置可能
- ポートフォリオ本体ページもこのコンポーネント経由でツイートを表示する想定

### 5.2 単体ビュー (`/tweets/[id]`)

**表示（混合パターン）:**
- スレッド全体を時系列順で表示
- アクセスされたツイートが該当する場合、そのツイートをハイライトしつつ前後の文脈も見せる
- 最上位（親）→ 子リプライ群を縦に並べる
- 各ツイートは独自URLを持つので、子リプライにもパーマリンクボタンを設置

**RTツイートの単体ビュー表示:**
- **コメントなしRT**: 元ツイートのスレッドにリダイレクト or 元ツイートを大きく表示+「自分がRT」のラベル付与
- **引用RT**: 自分のコメントを大きく表示し、元ツイートを引用カードとして埋め込み。元ツイートには元ツイートの単体ビューへのリンクを付ける

**メタデータ（OGP）:**
- `<title>`: ツイート本文の冒頭40文字 + " | [サイト名]"
- `<meta property="og:description">`: ツイート本文の冒頭120文字
- `<meta property="og:image">`: 添付画像の1枚目があればそれ、なければサイト共通OG画像
- `<meta name="twitter:card">`: `summary_large_image`

### 5.3 管理・投稿画面 (`/admin`)

**レイアウト:** Twitter風の左右2カラム

**左カラム（投稿エリア）:**
- テキストエリア（自動高さ調整）
- 文字数カウンター（CJK 2倍カウント。残20以下で黄色、超過で赤）
- 画像アップロードボタン（最大4枚、ドラッグ&ドロップ対応）
- 「下書き保存」「投稿」ボタン
- 投稿時、現在見ているツイート詳細が表示中であれば自動的にそのツイートへの**セルフリプライ**として保存（オプションをトグルで切替可能）
- 引用RTモード時は元ツイートのプレビューが表示される

**右カラム（管理エリア）:**
- 自分の最近のツイート一覧（公開済み）
- 各ツイートに以下のアクションボタン:
  - **編集**: 編集画面へ遷移
  - **削除**: 確認モーダル後、削除
  - **🔁 RT**: コメントなしリツイート。即実行（確認モーダルあり）
  - **💬 引用RT**: 左カラムの投稿エリアが「引用RTモード」に切り替わり、コメント入力後に投稿
  - **↩ リプライ**: 左カラムが「セルフリプライモード」に切り替わる
- タブ切り替えで「下書き一覧」「リツイート済み一覧」を表示可能
- 各ツイートクリックで右側に詳細を展開、そこから返信可能

**RT機能の補足:**
- コメントなしRTは同一ツイートに対して何度もできないようバリデーション（DBで`retweetOf`の重複をチェック）
- RTの解除（取り消し）は、自分のRTツイート自体を削除することで実現
- 引用RTは何度でも可能（コメント内容が異なるため）

**認証:**
- Cloudflare Access が `/admin/*` 配下のリクエストをエッジで遮断
- 未認証ユーザーは Access のログイン画面へ自動リダイレクト
- 認証通過後、リクエストヘッダ `Cf-Access-Jwt-Assertion` にJWTが付与される
- アプリ側のMiddlewareで念のためJWTを検証し、AUDタグの一致を確認（多層防御）
- ログインユーザーのメールアドレスは `Cf-Access-Authenticated-User-Email` ヘッダで取得可能（UI表示用）

---

## 6. 投稿〜公開のフロー

```
[投稿/編集/削除]
       │
       ▼
[Cloudflare Access のエッジ認証]
       │
       │ JWT付与
       ▼
[Next.js API Route / Server Action]
       │
       ├─► [Middleware で JWT検証]
       │
       ▼
[microCMS Management API へ書き込み]
       │
       ▼
[microCMS が Webhook を発火]
       │
       ▼
[/api/revalidate が受信] ※ AccessはBypass、HMAC署名で検証
       │
       ├─► revalidatePath('/feed')
       └─► revalidatePath(`/tweets/${id}`)
              + 親ツイートがあればそのページも
       │
       ▼
[OpenNextがKV内のISRキャッシュを更新]
       │
       ▼
[次回アクセス時に最新版を配信]
```

**Webhookの認証:**
microCMSのWebhook署名（HMAC）を検証する。シークレットは `wrangler secret put` で管理。
このエンドポイントは Cloudflare Access の Bypass Policy 対象とし、microCMS から直接到達できるようにする。

---

## 7. セキュリティ

| 項目 | 対策 |
|---|---|
| 投稿APIの認可 | Cloudflare Accessのエッジ認証 + 念のためアプリ側でJWT (`Cf-Access-Jwt-Assertion`) を検証 |
| Webhook検証 | microCMS署名（HMAC-SHA256）を検証。Webhookエンドポイントはアクセスポリシーで Bypass 設定 |
| microCMS APIキー | Workers Secretsで管理、クライアントへは絶対に露出させない |
| CSRF | Server Actions利用時のNext.js組み込み保護 + Cloudflare AccessのSameSite制御 |
| 画像アップロード | アプリ経由でmicroCMSにプロキシし、Access認証通過後のみ転送 |
| Rate Limiting | Cloudflareのダッシュボードで設定（Workers不要） |
| ローカル開発時の認証回避 | `BYPASS_AUTH=true` かつ `NODE_ENV=development` のAND条件のみ素通り |

---

## 8. 環境変数

```
# microCMS
MICROCMS_SERVICE_DOMAIN=
MICROCMS_API_KEY=                # コンテンツ取得用
MICROCMS_MANAGEMENT_API_KEY=     # 投稿・編集・削除用
MICROCMS_WEBHOOK_SECRET=

# Cloudflare Access (アプリ側でのJWT検証用)
CF_ACCESS_TEAM_DOMAIN=           # 例: yourteam.cloudflareaccess.com
CF_ACCESS_AUD=                   # AccessアプリケーションのAUDタグ

# Site
NEXT_PUBLIC_SITE_URL=

# ローカル開発時のみ
BYPASS_AUTH=                     # 'true' で認証スキップ。本番では未設定
```

### 8.1 環境変数の管理方法

- **本番（Cloudflare Workers）**: `wrangler secret put` でSecretsとして登録
- **ローカル**: `.env.local` に記載（gitignore対象）
- **`.env.example`**: プレースホルダのみコミット
- **公開キー（NEXT_PUBLIC_）**: `wrangler.toml` の `[vars]` セクションに記載可

### 8.2 wrangler.toml の構成例

```toml
name = "echolog"
main = ".open-next/worker.js"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[vars]
NEXT_PUBLIC_SITE_URL = "https://your-domain.com"

[[kv_namespaces]]
binding = "NEXT_INC_CACHE_KV"   # OpenNextがISRキャッシュに使用
id = "..."

[assets]
directory = ".open-next/assets"
```

---

## 9. ディレクトリ構成（案）

```
/
├── app/
│   ├── (public)/
│   │   ├── page.tsx              # ポートフォリオトップ
│   │   ├── feed/
│   │   │   └── page.tsx          # リストビュー
│   │   └── tweets/[id]/
│   │       └── page.tsx          # 単体ビュー
│   ├── (admin)/
│   │   └── admin/
│   │       ├── page.tsx
│   │       ├── edit/[id]/
│   │       │   └── page.tsx
│   │       └── drafts/
│   │           └── page.tsx
│   ├── api/
│   │   ├── tweets/
│   │   ├── revalidate/
│   │   └── og-preview/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── feed/
│   │   ├── TweetFeed.tsx         # 埋め込み可能なリストビュー
│   │   ├── TweetCard.tsx
│   │   └── ThreadView.tsx
│   ├── admin/
│   │   ├── ComposeForm.tsx
│   │   ├── CharCounter.tsx
│   │   └── ImageUploader.tsx
│   └── ui/
├── lib/
│   ├── microcms.ts
│   ├── access.ts                 # Cloudflare Access JWT検証
│   ├── env.ts                    # 環境変数のzodバリデーション
│   ├── constants.ts              # MAX_TWEET_LENGTH 等
│   └── og.ts
├── middleware.ts                 # Access JWT検証 + ローカル開発時bypass
├── next.config.ts
├── open-next.config.ts           # OpenNext設定
├── wrangler.toml                 # Cloudflare Workers設定
├── .dev.vars                     # ローカル開発用secrets（gitignore）
└── package.json
```

---

## 10. 実装フェーズ案

### Phase 1: 基盤（最小投稿〜表示）
- Next.jsプロジェクト初期化、microCMS API疎通
- `tweets` APIモデル作成、ダミーデータ投入
- リストビュー、単体ビュー（リプライ・RTなし版）
- ISR + Webhookの動作確認

### Phase 2: 認証 + 投稿UI
- Cloudflare Access のApplication作成、Policy設定（オーナー側で実施）
- アプリ側でJWT検証ミドルウェアを実装
- ローカル開発時の認証bypass（`BYPASS_AUTH` 環境変数）
- 管理画面の投稿フォーム、文字数カウンター（CJK 2倍カウント対応）
- 編集・削除機能
- 下書き機能

### Phase 3: スレッド機能 + リツイート機能
- セルフリプライの投稿フロー
- 単体ビューでのスレッド表示
- リストビューでのスレッド集約表示
- コメントなしRT、引用RTの投稿・表示

### Phase 4: リッチ化
- 画像アップロード
- OGP展開（リンクプレビュー）
- ポートフォリオへの埋め込み統合

### Phase 5: 仕上げ
- OGメタタグ最適化
- パフォーマンスチューニング
- エラーハンドリング、Rate Limiting

---

## 11. 確定した仕様（最終確認結果）

| 項目 | 決定内容 |
|---|---|
| 文字数カウント | Twitter準拠（CJK 2倍カウント、上限280） |
| 画像枚数 | 1ツイートあたり最大4枚 |
| 公開部分のデザイン | 後日別途作成。まず機能ドラフトを優先 |
| リツイート機能 | スコープ内、優先度高（Phase 3で実装） |

---
