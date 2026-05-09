# ポートフォリオへの埋め込み

`echolog` は同一 Next.js プロジェクト内に公開ビューを持つので、`<TweetFeed />` を React コンポーネントとして直接 import して、ポートフォリオの任意ページに最新ツイートを差し込めます。

## 最小例

```tsx
// app/(public)/page.tsx などポートフォリオの任意ページ
import { TweetFeed } from "@/components/feed/TweetFeed";

export default function HomePage() {
  return (
    <main>
      <h1>Hi, I'm cubicberry</h1>
      <p>普段書いているもの:</p>
      <TweetFeed limit={5} />
    </main>
  );
}
```

`TweetFeed` は **Server Component** なので Suspense や fetch キャッシュがそのまま効きます。`limit` は最大表示件数、`showHeader` で見出しの ON/OFF を切り替え可能。

## Props

| Prop | 型 | デフォルト | 用途 |
|---|---|---|---|
| `limit` | `number` | `20` | 表示件数（親ツイートのみが対象） |
| `showHeader` | `boolean` | `true` | 「最新のツイート」見出しと「すべて見る →」リンクの表示 |

## ISR と再検証

`TweetFeed` を埋め込んだページは以下を設定すれば一緒に ISR + Webhook 再検証の対象になります:

```tsx
export const revalidate = 3600;
```

`/api/revalidate` は新規投稿時に `/`, `/feed`, `/tweets/<id>` を `revalidatePath` するので、ポートフォリオトップ `/` に埋め込んだ場合も自動で更新されます。`/about` のような他のパスに埋める場合は、`app/api/revalidate/route.ts` の `revalidatePath` 呼び出しに該当パスを追加するか、対応するキャッシュタグを設計してください。

## 注意点

- スレッド集約済み（親ツイートのみ）、コメントなし RT は「🔁 自分がリツイート」ラベル付きで表示される
- 引用 RT は本文 + 引用カード形式
- 各ツイートカードのリンク先は `/tweets/<id>` で、フル機能のスレッド単体ビューに飛ぶ
- スタイルは Tailwind v4 で、layout.tsx の `--color-background` / `--color-foreground` / `--color-muted` / `--color-border` を上書きすればデザイン側で吸収可能
