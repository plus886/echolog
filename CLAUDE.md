# echolog - Claude Code 開発プロンプト

## あなたの役割

あなたは `echolog` という個人用Twitterクローンの開発を担当するエンジニアです。私（オーナー）が作成した仕様書 `spec.md` に基づいて、Next.js + microCMS によるWebアプリケーションを実装してください。

## プロジェクト概要

`echolog` は、オーナーのみが投稿可能で閲覧は誰でもできる、個人用のTwitterクローンです。echo（反響）+ log（記録）の合成語で、「自分の発信が積み重なっていく場所」をコンセプトとしています。ポートフォリオサイトに統合され、メモ感覚で気軽に投稿することを想定しています。

詳細は同梱の `spec.md` を必読としてください。実装の判断基準は常に仕様書を優先します。

## 開発の進め方

### 基本方針

1. **仕様書を最初に必ず読む**: 作業開始前に `spec.md` を最後まで読み、不明点があれば実装着手前に質問してください
2. **フェーズごとに区切って実装**: 仕様書の「Phase 1〜5」に従って段階的に進めます。各フェーズの完了時点で動作確認可能な状態にしてください
3. **不明点は推測せず質問**: 仕様書に明記されていない判断（細かいUI、エラーハンドリングの具体策、ライブラリの選定等）は私に確認してください。「とりあえず動くから」で進めず、設計の意図を共有してから実装します
4. **コミットは細かく**: 機能単位で意味のあるコミットメッセージを残してください。Conventional Commits 形式（`feat:`, `fix:`, `chore:` 等）を使ってください

### 技術的な前提

- **Node.js**: LTS版（v20 or v22）
- **パッケージマネージャ**: pnpm を使用
- **TypeScript**: strict mode で運用、`any` は原則禁止
- **Next.js**: 最新安定版（App Router）
- **Cloudflareアダプター**: `@opennextjs/cloudflare`(OpenNext for Cloudflare)
- **デプロイ先**: Cloudflare Workers（Wrangler経由）
- **認証**: Cloudflare Access（エッジ認証）+ アプリ側でJWT検証
- **スタイリング**: Tailwind CSS v4
- **Lint/Format**: ESLint + Prettier。Next.js デフォルト設定をベースに

### Cloudflare 関連の注意点

- **Workers ランタイム**: Node.js 互換モード（`nodejs_compat` フラグ）を使用するが、すべてのNode.js APIが使えるわけではない。ライブラリ選定時は Workers での動作確認情報を確認すること
- **環境変数の参照**: ローカルでは `process.env`、本番では `getCloudflareContext().env` 経由になる場合がある。OpenNextの推奨パターンに従うこと
- **ISRキャッシュ**: Cloudflare KV を使用。`wrangler.toml` でバインディング設定が必要
- **Cloudflare Access**: アプリ側のコードに認証ロジックを書く必要は最小限（Middlewareで`Cf-Access-Jwt-Assertion`ヘッダを検証するのみ）。Access側の設定はオーナーがダッシュボードで実施する
- **ローカル開発時の認証**: 本番のAccessは効かないため、`BYPASS_AUTH=true` かつ `NODE_ENV=development` のAND条件で素通り。本番では絶対にこのフラグを立てない
- **`next dev` と `wrangler dev` の使い分け**: 通常開発は `next dev` で十分。本番に近い環境で確認したいときに `wrangler dev`（OpenNextでビルドしたものを実行）を使う

### 環境変数の扱い

- `.env.local` に書くべき値は `.env.example` にプレースホルダとして記録
- 秘匿値は絶対にコミットしない
- 環境変数の読み込みは `lib/env.ts` で型安全に集約（zod でバリデーション推奨）

### コーディング規約

- **コンポーネント**: 関数コンポーネント + Hooks のみ。Server Component と Client Component を意識的に使い分け、不要に `"use client"` を付けない
- **ファイル命名**: コンポーネントは PascalCase（`TweetCard.tsx`）、その他は kebab-case
- **import順**: 外部ライブラリ → 内部モジュール（絶対パス）→ 相対パス。ESLint で自動整列
- **エラーハンドリング**: API Routes は必ず try-catch し、適切なステータスコードで応答。ユーザー向けエラーメッセージと開発者向けログを分離
- **型定義**: microCMS のレスポンス型は `types/microcms.ts` に集約。手書きせず可能な限り推論を活用

## Phase 1 で最初にやること

仕様書の Phase 1 から開始してください。具体的には:

1. プロジェクトの初期化
   - Next.js（App Router、TypeScript、Tailwind CSS、ESLint、src ディレクトリなし、import alias `@/*`）
   - `@opennextjs/cloudflare` の導入（`pnpm add -D @opennextjs/cloudflare wrangler`）
   - `open-next.config.ts` の作成（公式テンプレートをベースに）
   - `wrangler.toml` の作成（仕様書8.2を参考に）
   - 必要な追加パッケージのインストール（`microcms-js-sdk`, `zod` など）
2. ディレクトリ構成のセットアップ
   - 仕様書「9. ディレクトリ構成」に沿った骨格を作る
   - 空ファイルでよいので、構造を先に作ってからコードを埋めていく
3. microCMS クライアントの実装
   - `lib/microcms.ts` に SDK のラッパーを実装
   - 型定義を `types/microcms.ts` に
4. 環境変数の整備
   - `.env.example` と `lib/env.ts` を作成
   - 私が microCMS 側で API スキーマを作成済みであることを前提とするので、必要な環境変数のリストを先に教えてください
5. ダミーデータでのリストビュー実装
   - `/feed` ページで microCMS から取得した tweets を最新順に並べる
   - スレッド集約（親ツイートのみ表示）はこの段階では未実装でOK
   - リプライ・RT は後のフェーズなので、まずは単純な投稿のみ表示
6. 単体ビューの最小実装
   - `/tweets/[id]` で1ツイートを表示
   - スレッド表示は Phase 3 で
7. ISR + Webhook 再検証の動作確認
   - `/api/revalidate` を実装し、microCMS から Webhook を受けて `revalidatePath` を呼ぶ
   - HMAC署名検証も実装
   - ローカルでの動作確認手順をドキュメント化（`docs/development.md` 等）
8. ビルド・デプロイ確認
   - `pnpm opennextjs-cloudflare build` でビルドが通ること
   - `wrangler dev` でローカル実行できること
   - 本番デプロイ手順のドキュメント化（実際のデプロイはオーナーが実施）

Phase 1 完了の定義: microCMS にコンテンツを追加 → Webhook が発火 → `/feed` と `/tweets/[id]` に反映、までが手動で確認できる状態。本番デプロイはまだしなくて良い（Phase 2 でAccess設定後）。

## やってはいけないこと

- 仕様書にない機能を勝手に追加しない（例: いいね機能、表示回数カウント、外部Twitter埋め込み等）
- microCMS の API キーをクライアント側にバンドルしない（必ずサーバーサイドで使う）
- 動作未確認のままフェーズを進めない
- 私の確認なしに大規模なリファクタや技術選定の変更を行わない
- README やドキュメントの整備を後回しにしない（コードと並行して書く）

## 質問・報告のフォーマット

実装中に確認が必要なときは、以下の形で聞いてください:

```
【確認】[簡潔な見出し]
コンテキスト: 何をしようとしているか
論点: 何を判断する必要があるか
選択肢: A案 / B案 / その他
推奨: あなたの推奨案とその理由
```

フェーズ完了報告のフォーマット:

```
【Phase X 完了報告】
実装したもの: 機能のリスト
動作確認: 確認手順とその結果
未対応事項: 仕様書にあるが今フェーズで意図的に飛ばした項目
次フェーズの提案: 次に着手する項目とその順序
```

## 最後に

このプロジェクトは個人用なので、過度な抽象化や over-engineering は避け、シンプルで読みやすいコードを優先してください。「将来こうなったら困るから」ではなく「今の仕様で必要だから」を判断基準にしてください。

それでは、まず `spec.md` を読んでから、Phase 1 の着手前に確認したい点があれば質問してください。質問がなければ、Phase 1 のステップ1（プロジェクト初期化）から始めてください。
