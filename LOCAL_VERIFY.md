# Local Verification — Astro 版 echolog

phase 6-2 以降の preview / 本番デプロイに進む前に、`_astro/` の Astro 6
版がローカルで期待どおり動作することを確認するための手順書。

2 つの実行モードを使い分ける:

| モード | 用途 | コマンド | URL | admin | HMR |
|---|---|---|---|---|---|
| **A. Astro dev** | 日常の開発/UI 調整 | `npm run dev` | http://localhost:4321 | ✅ bypass 可 | ✅ |
| **B. Wrangler dev** | 本番ランタイム検証 | `npm run build && npx wrangler dev` | http://localhost:8787 | ❌ 401 (期待動作) | ❌ |

両方を最低 1 回ずつ通すこと。A だけだと "本番ビルドでだけ落ちる" 系のバグ
(named export 不一致や adapter binding 要求) を取り逃す。B だけだと
admin UI の挙動が見られない。

---

## 0. 前提

- Node v22 以上 (`node -v`)
- リポジトリの `.env.local` に microCMS / Cloudflare Access のシークレット
  類が入っていること (旧 Next.js 側と同じファイル)

## 1. ワンタイムセットアップ

```bash
cd _astro
npm install
```

`_astro/.dev.vars` を作る (シークレット値を `.env.local` から取り込む):

```bash
# .env.local の値をそのままコピーして、Astro 流の変数名に rename
cp ../.env.local .dev.vars
sed -i.bak 's/^NEXT_PUBLIC_/PUBLIC_/g' .dev.vars && rm .dev.vars.bak
```

確認 (値はマスクして key 名だけ出る):

```bash
sed -n 's/^\([A-Z_][A-Z0-9_]*\)=.*/\1=***/p' .dev.vars | sort
```

期待される key:
- `BYPASS_AUTH`
- `CF_ACCESS_AUD`
- `CF_ACCESS_TEAM_DOMAIN`
- `FORMOSA_MICROCMS_API_KEY`
- `FORMOSA_MICROCMS_SERVICE_DOMAIN`
- `FORMOSA_MICROCMS_WEBHOOK_SECRET`
- `MICROCMS_API_KEY`
- `MICROCMS_MANAGEMENT_API_KEY`
- `MICROCMS_SERVICE_DOMAIN`
- `MICROCMS_WEBHOOK_SECRET`
- **`PUBLIC_SITE_URL`** (旧 `NEXT_PUBLIC_SITE_URL` から rename)

> `.dev.vars` は `_astro/.gitignore` で除外済み。コミットしないこと。

---

## 2. モード A: `npm run dev` (Astro dev server)

### 起動

```bash
cd _astro
npm run dev
```

→ http://localhost:4321 が立ち上がる。

### ブラウザで目視確認するページ

| URL | 期待 |
|---|---|
| `/` | ホーム gallery 表示。hero に縦書き「康凱爾」+「KO KAIJI」。スクロールで gallery の写真と quote が fade-in、`.is-scrolled` 切替で nav が下りてくる |
| `/tweets/<実 id>` | tweet 詳細。本文、reply chain、画像サムネ (96×96)。サムネクリックで View Transitions 拡大、ESC で morph で縮小 |
| `/admin` | compose form + Recent。`BYPASS_AUTH=true` のため middleware が通過し、ヘッダに `local-dev@echolog.local` + `bypass` chip |
| `/admin/drafts` | 下書き一覧 |
| `/admin/edit/<id>` | 編集フォーム |
| `/robots.txt` | プレーンテキスト、`Disallow: /admin /api/`、`Sitemap: ...` |
| `/sitemap.xml` | XML、tweet 一覧含む |

### curl による smoke test

```bash
# HOME — Island 11 個分の hydrate marker を確認
curl -s http://localhost:4321/ | grep -c astro-island
# 期待: 11

# tweet 詳細 — k-label-mini class が当たっていること
curl -s http://localhost:4321/tweets/<実 id> | grep -c k-label-mini
# 期待: 2 以上

# sitemap.xml — 実 tweet URL を含む
curl -s http://localhost:4321/sitemap.xml | grep -c '/tweets/'

# admin が 401 を返さないこと (= bypass が効いている)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/admin
# 期待: 200
```

### admin の write 系を試す

ComposeForm で適当な本文を入れて `publish` ボタンを押す:

- 成功時: form が空に戻り、Recent カラムが再 fetch → 新 tweet が一番上に
- エラー時: form 下に italic で error message

`save draft` も同様。draft を作ったら `/admin/drafts` に出ることを確認。
`edit` リンクで `/admin/edit/<id>` に遷移し、本文編集 + save。

retweet ボタン: 確認ダイアログ → 「↻ retweeted」表示に切替。
delete ボタン: 確認ダイアログ → 行が消えて list 再描画。

### 既知の挙動 (バグではない)

- **Chrome flash**: 公開ページで navigate した瞬間、PortfolioNav と KO KAIJI
  pin が一瞬消えてから出てくる。原因は React Island の `client:only="react"`
  で SSR 出力が無いため。Phase 5 で `<ClientRouter />` + `transition:persist`
  を入れたので、**同じ public ルート同士の遷移** (例: home → tweet 詳細) で
  は flash しない (chrome 要素が persist される)。初回 reload や public ↔
  admin の遷移では flash が見える可能性あり。
- **dev 限定の OGP image**: `og:image` は `/og-default.png` を指すが、
  リポジトリにそのファイルは無い → ブラウザの og preview ツールでは
  画像が空で出る。本番デプロイ前に対応予定 (現状の Next.js 側でも同じ)。

---

## 3. モード B: `npx wrangler dev` (workerd ランタイム)

### 起動

```bash
cd _astro
npm run build           # dist/ を生成
npx wrangler dev        # dist/ の build 出力を Cloudflare ランタイムで実行
```

→ http://localhost:8787

### `npm run build` で期待される出力

```
[build] Server built in ~6s
```

エラーが出る場合の代表例:
- `"default" is not exported by "src/components/Foo.tsx"` — 該当ファイルに
  `export default Foo;` 行が無い。phase 6-1 で全 component に追加済み
  なので、新規 React Island を作ったときだけ気をつける
- `IMAGES is not bound` — adapter 設定が壊れていないか確認
  (`astro.config.mjs` の `imageService: "passthrough"`)

### `wrangler dev` 起動後の確認

```bash
curl -s -w "HTTP:%{http_code}\n" http://localhost:8787/
# 期待: 200, ~40KB

curl -s -w "HTTP:%{http_code}\n" http://localhost:8787/tweets/<実 id>
# 期待: 200

curl -s -w "HTTP:%{http_code}\n" http://localhost:8787/admin
# 期待: 401 (本番ランタイムでは BYPASS_AUTH が無効化されるため。これは正しい挙動)

curl -s http://localhost:8787/robots.txt | head -3
curl -s http://localhost:8787/sitemap.xml | head -3
```

### モード B での admin 動作確認

`import.meta.env.DEV` が build 時に false に焼き込まれるため、`wrangler dev`
では `BYPASS_AUTH=true` が効かない (= 本番と同じ挙動)。admin を試したい
場合は次の選択肢:

- **モード A に切り替える** (推奨): `npm run dev` で 4321 番ポートで普通に
  試せる。
- **本物の Cloudflare Access JWT を手で渡す** (高難度): `Cf-Access-Jwt-Assertion`
  ヘッダに有効な JWT を付けて curl すれば middleware を通過できる。phase
  6-2 の preview deploy 後にしか試せないので、ローカルでは諦める。

### Action endpoint の Origin check

curl から `/api/tweets` (POST) や `/_actions/publishTweet` を直接叩こうとすると、Astro
Actions の CSRF 防御で 403 になる:

```
{"error":"unauthorized","reason":"missing-jwt"} or
"Cross-site POST form submissions are forbidden"
```

これは正常。ブラウザの form 経由 (`<form action={actions.publishTweet}>`
or `await actions.publishTweet(formData)` from React) で叩いた場合は Origin が
正しく付くため通過する。

---

## 4. 旧 Next.js 版との並行確認

phase 6-3 (ファイルスワップ) より前は **旧 Next.js プロジェクトもルートに
残っている**。両方を別ポートで起動して比較できる:

```bash
# ターミナル1: Next.js 旧版
cd /Users/.../echolog
pnpm dev                  # http://localhost:3000

# ターミナル2: Astro 新版
cd /Users/.../echolog/_astro
npm run dev               # http://localhost:4321
```

同じ tweet を `/tweets/<id>` で開き、レンダリングが視覚的に一致するか比較。
ブラウザの DevTools Network タブで HTML サイズと JS bundle サイズも比較
できる (Definition of Done で旧版の 50% 以下を目標)。

---

## 5. トラブルシュート

| 症状 | 原因 | 対処 |
|---|---|---|
| `/` が空 body の HTTP 200 | React Island が SSR で死んだ | 該当 Island を `client:only="react"` に切替 (`client:load` から) |
| FontPlus が読まれない | network エラー or CSP | FontPlus URL を `<script is:inline>` で読んでいるか確認。fallback に Cormorant Garamond が当たれば OK |
| 「KO KAIJI」が「KOKAIJI」 | NBSP regression | `_astro/src/components/nav-ripple.tsx` の `ch === " " ? " " : ch` の 2 つ目が NBSP (U+00A0) であること。`xxd` で `c2 a0` が見えるはず |
| `/api/og-preview` が 502 | 外部 URL に 5 秒以内に到達できない | timeout / DNS の問題。違う URL で試す |
| `/admin` が `wrangler dev` で 401 | 本番ランタイムでの想定動作 | モード A で確認、または本物の JWT を渡す |
| build error: `"default" is not exported` | 新規 .tsx に `export default` が無い | ファイル末尾に `export default ComponentName;` を追加 |
| Astro が `IMAGES`/`SESSION` 警告を出す | adapter のデフォルト機能 | IMAGES は `imageService: "passthrough"` で OFF 済。SESSION は phase 6 後半で対応 |

---

## 6. クイックリファレンス

```bash
# 開発
cd _astro && npm run dev

# 本番ビルド + ローカル本番ランタイム
cd _astro && npm run build && npx wrangler dev

# 型生成 (wrangler.jsonc 変更後)
cd _astro && npm run cf-typegen

# ビルド出力の inspect
cd _astro && find dist -maxdepth 3 -type f | head
cd _astro && du -sh dist/server dist/client
```
