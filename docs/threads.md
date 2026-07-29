# Threads 連携（予約投稿）

管理画面から formosa/days の写真を、言語別の 2 つの Threads アカウントへ
予約投稿する仕組み。予約は 1 回の操作で 2 チャンネルに同じ時刻で積まれ、
以後の管理（日時変更・取消・返信・削除）はチャンネルの行ごとに行う。

| チャンネル             | 本文                    | alt   | トピックタグ | リプライで貼る URL              |
| ---------------------- | ----------------------- | ----- | ------------ | ------------------------------- |
| `threads-zh`（中文）   | passageZh（中文詩）     | altZh | `街頭攝影`   | `photo.kokaiji.tw/zh/days/{id}` |
| `threads-ja`（日本語） | passageJa（日本語短歌） | altJa | `短歌`       | `photo.kokaiji.tw/days/{id}`    |

トピックタグは Threads の仕様で 1 投稿 1 つまで。チャンネル固定値として
`src/lib/threads-channels.ts` の `CHANNEL_TOPIC_TAG` に持つ（写真ごとの
指定はしない）。変更はその定数を書き換えるだけでよい。

## アーキテクチャ

- **キュー / 投稿ログ / トークン**: Cloudflare D1（binding `THREADS_DB`、
  スキーマは `migrations/0001_threads.sql`）
- **配信**: Cloudflare Cron Triggers（5分毎、`wrangler.jsonc` の `triggers`）。
  `@astrojs/cloudflare` のカスタム Worker エントリ `src/worker.ts` が
  `fetch`（Astro）と `scheduled`（`src/lib/threads-cron.ts`）を同居させる
- **認証**: チャンネルごとに Threads OAuth で長期トークン（約60日）を取得
  して D1（`threads_accounts`）に保存し、cron が 7 日ごとに自動リフレッシュ。
  失効したら管理画面から該当チャンネルを再接続。同じアカウントを両チャンネル
  に接続しようとするとガードされる（2 重投稿事故の防止）
- **予約ロジック**: 台湾時間 20:00–22:00 のランダムな分。1日2件まで、
  同日2件は60分以上離す。明日から順に空きのある日へ割り当て

## 初回セットアップ

### 1. Meta アプリの作成（オーナー作業）

1. [developers.facebook.com](https://developers.facebook.com) で開発者登録
2. アプリを新規作成し、ユースケースで「Threads API にアクセス」を選択
3. 権限を有効化:
   `threads_basic` / `threads_content_publish` / `threads_read_replies` /
   `threads_manage_replies` / `threads_manage_insights` / `threads_delete`
4. **両方の** Threads アカウント（中文用・日本語用）を **Threads テスター**
   に追加し、それぞれの Threads アプリ側（設定 > アカウント >
   ウェブサイトのアクセス許可）で招待を承認
5. **リダイレクト URI** に `https://kokaiji.tw/admin/threads/oauth/callback`
   を登録
6. App ID / App Secret を控える

アプリは開発モードのままで良い（テスターに追加した自分のアカウントだけが
使える = この用途では十分）。

### 2. Cloudflare 側（オーナー作業）

```bash
# D1 データベース作成 → 出力の database_id を wrangler.jsonc に転記
wrangler d1 create echolog-threads

# スキーマ適用（本番）
wrangler d1 migrations apply echolog-threads --remote

# シークレット投入
wrangler secret put THREADS_APP_ID
wrangler secret put THREADS_APP_SECRET
```

ローカル開発用に `.dev.vars` にも `THREADS_APP_ID` / `THREADS_APP_SECRET` を
追記し、ローカル D1 にもスキーマを適用する:

```bash
wrangler d1 migrations apply echolog-threads --local
```

### 3. アカウント接続

デプロイ後、`/admin` の Threads タブでチャンネルごとに接続する。

1. threads.net で**中文用アカウントにログインした状態**で「中文アカウントと
   接続」→ Meta の認可画面で承認
2. threads.net で**日本語用アカウントに切り替えて**から「日本語アカウントと
   接続」→ 承認

認可されるのは threads.net に現在ログインしているアカウントなので、切り替え
を忘れると同一アカウント接続のガードに当たる（エラーメッセージが出るだけで
保存はされない）。トークンは D1 に保存され、以後 cron が自動リフレッシュする。

## 予約投稿の運用

1. **予約**: `/admin` 文章管理タブ → 各写真の「Threads予約」。1 回の操作で
   中文・日本語の 2 チャンネルが**同じ空き枠**（台湾時間 20:00–22:00 の
   ランダム分、1日2件まで、同日60分以上間隔、明日以降の最初の空き日）に
   積まれ、チャンネル別のバッジで予約時刻が表示される。文章未生成・
   未接続・予約済みのチャンネルはスキップされ、理由が注記として出る
   （片方だけの予約も可能）
2. **管理**: Threads タブの予約キューで日時変更（台湾時間で入力・枠外も
   可）・取消・今すぐ投稿・投稿前プレビュー（フィードで目立つ先頭40字と
   画像の縦横比チェック）ができる
3. **配信**: Cron が5分毎に予定時刻を過ぎた予約を拾い、行のチャンネルの
   アカウントで「写真+本文の本体ポスト → そのチャンネルの言語の
   ギャラリー URL をリプライでぶら下げ」の順に投稿する。本文と alt_text
   は**投稿時点の最新データ**を microCMS から読む（予約後の手直しが反映
   される）。投稿した本文は snapshot としてログに残る
4. **失敗時**: 行が「失敗」になりエラーが表示される。日時変更で再予約
   するか「今すぐ投稿」で即時リトライ。URL リプライだけ失敗した場合は
   本体は投稿済み扱いで、ログに注記が残る
5. **ログ**: 投稿済み・削除済みの履歴。permalink から Threads 上の
   ポストを開ける
6. **公開後**: ログ行の「返信・表示回数」を開くと、その投稿の表示回数と
   届いた返信（ネストを平坦化した会話全体。URL をぶら下げた自分の
   リプライは除外）が出る。各返信の「返信」からその場で返せる。
   「削除」は Threads 上のポストと URL リプライを削除し、行は履歴として
   「削除済み」で残る
7. **返信の見落とし防止**: cron が返信状況を D1 に同期し、開かなくても
   バッジで分かるようにしてある。最新の返信が自分以外のものなら
   「要返信」、返信済みなら件数のみ。未返信がある投稿はログの先頭に寄せ、
   admin のタブにも件数バッジが出る

### 返信同期の設計

Threads API には「自分の全投稿への返信」をまとめて取る口が無く、投稿
1 件につき `conversation` を 1 回引く必要がある。管理画面を開くたびに
全件ぶん叩くのは高いので、cron が少しずつ D1 へ同期し、画面は D1 を
読むだけにしている（`migrations/0002_reply_stats.sql`）。

- 1 回の cron につき最大 5 件、同期が古い順（未同期が先頭）に巡回
- 対象は公開後 90 日以内の投稿（それより古いものに返信は付きにくい）
- 返信一覧を開いたときと返信を送ったときは、その場で D1 も更新する
  （次の cron を待たずにバッジへ反映される）

補足:

- 表示回数（`views`）は Meta 側で "in development" 扱いのメトリクスで、
  取得できないことがある。その場合も返信は表示される
- 削除は 100 件/日/アカウントの上限がある（この運用では届かない）
- 返信・表示回数はログ行を開いたときだけ取得する（一覧表示のたびに
  全件ぶん API を叩かないため）

「今すぐ投稿」は cron と同じコードパス（claim → publish）を HTTP から
実行するので、cron 配信の動作確認にも使える。

## ローカル開発

- `astro dev` では D1 は wrangler のローカルシミュレーション
  （`.wrangler/state/`）を使う。`--local` の migration 適用が前提
- OAuth のリダイレクト URI は本番ドメインで登録しているため、ローカルでは
  「長期トークンを手動登録」（Threads タブ内の折りたたみ）を使う
- cron の scheduled ハンドラは**ローカルでは発火テストできない**。
  静的アセット併用の Worker は wrangler dev で内部ルーターワーカーが
  前段に入るため、`--test-scheduled` の `/__scheduled` はユーザーワーカー
  へ届かず Astro の 404 になる（本番の Cron Triggers はルーターを経由
  せず直接 `scheduled` を呼ぶので影響なし）。デプロイ後にダッシュボード
  （Workers > echolog > Settings > Triggers）と observability ログで
  5 分毎の実行を確認する。配信ロジック自体は admin の「今すぐ投稿」
  （予約キューのフェーズで追加）から同じコードパスを HTTP 経由で
  実行できる

## セキュリティ上の注意（/\_actions の保護）

Threads 連携の追加に合わせ、middleware の認証対象に `/_actions`（Astro
Actions のエンドポイント）を加えた。それまで actions は app 側の認証
チェックを通っておらず、Cloudflare Access のパス（`/admin*`）外のため
本番で未認証のまま叩ける状態だった。

Access が JWT ヘッダ（`Cf-Access-Jwt-Assertion`）を注入するのは Access
application のパスに一致したリクエストだけなので、admin ページから fetch
される `/_actions` ではヘッダの代わりに、Access ログイン時にドメインへ
発行される `CF_Authorization` クッキー（同じ JWT）を検証する。

デプロイ後の確認: `/admin` からツイート投稿など任意の action が通ること、
未ログインの別ブラウザから `curl -X POST https://kokaiji.tw/_actions/threadsStatus -H "Origin: https://kokaiji.tw" -H "Content-Type: application/json" -d '{}'` が 401 になること。
