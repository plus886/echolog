# Twitterクローン: 日本語投稿の繁體中文自動翻訳機能

## 目的

Astro製のTwitterクローンUIから日本語で投稿すると、Claude APIで台湾繁體中文に翻訳し、MicroCMSに両言語まとめて保存する機能を実装する。

## アーキテクチャ

```
[投稿UI(Astro)] → POST /api/posts
                    ↓
            [Astro API Route]
              1. Claude APIで翻訳(同期)
              2. MicroCMSに両言語をPOST
                    ↓
            [タイムライン表示(ja/zh-hant)]
```

## 技術スタック

- Astro (SSR mode, Node adapter or Cloudflare adapter)
- MicroCMS (Content API)
- Anthropic Claude API (`claude-sonnet-4-6`)

## MicroCMSスキーマ

API endpoint: `posts`

- `text_ja` (テキストエリア, 必須)
- `text_zh_hant` (テキストエリア)
- `media` (画像, 複数, 任意)
- `translation_status` (セレクト: `done` / `failed` / `manual_override`, デフォルト `done`)

## 環境変数

```
MICROCMS_SERVICE_DOMAIN=
MICROCMS_API_KEY=
ANTHROPIC_API_KEY=
```

## 実装する機能

### 1. `src/lib/translate.ts`

Claude APIで日本語→台湾繁體中文に翻訳する関数。

要件:

- `claude-sonnet-4-6` を使用
- システムプロンプトには以下を含める:
  - 台湾で使われる繁體中文(非香港繁體)であること
  - 絵文字・顔文字・URL・ハッシュタグ・メンションは原文のまま保持
  - 台語(Hokkien)の単語や固有名詞が混在する場合はそのまま保持
  - 出力は翻訳結果のテキストのみ(前置きや説明文を含めない)
- システムプロンプトに `cache_control: { type: 'ephemeral' }` を付与してプロンプトキャッシュを有効化
- エラー時は例外をthrow

### 2. `src/lib/microcms.ts`

MicroCMSへのPOST関数 `createPost({ text_ja, text_zh_hant, media?, translation_status })`。
microcms-js-sdk を使用。

### 3. `src/pages/api/posts.ts` (POSTエンドポイント)

- リクエストボディから `text_ja` を受け取る
- `translate()` で繁中翻訳を取得
- 翻訳失敗時は `translation_status: 'failed'` で `text_ja` のみ保存し、エラーを返さず投稿は成立させる
- 成功時は両言語をMicroCMSに保存
- レスポンスとして作成された投稿オブジェクトを返す

### 4. `src/components/PostForm.astro` (またはClient Component)

- テキストエリア + 投稿ボタンのシンプルなフォーム
- 投稿中はボタンをdisabledにしてローディング表示
- 投稿完了後にフォームをクリア

### 5. `src/pages/[lang]/index.astro` (タイムライン)

- `lang` パラメータ(`ja` または `zh-hant`)に応じて該当言語のフィールドを表示
- MicroCMSから最新順で投稿を取得
- 言語切り替えリンクをヘッダーに配置
- `astro.config.mjs` で i18n 設定(`defaultLocale: 'ja'`, `locales: ['ja', 'zh-hant']`)

## 注意点

- 投稿UIは管理者(自分のみ)が使う想定で、認証は今回スコープ外
- 翻訳の手動修正はMicroCMS管理画面から行い、その際 `translation_status` を `manual_override` に変更する運用とする(将来的にUIから修正可能にする拡張余地を残す)
- エラーハンドリングは最小限でOKだが、Claude API障害時もユーザーの投稿が失われないこと

## 実装の順序

1. 環境変数の `.env.example` を作成
2. `translate.ts` 単体で動作確認できる状態にする
3. `microcms.ts` を実装
4. APIルートを実装
5. フロントエンドを実装
