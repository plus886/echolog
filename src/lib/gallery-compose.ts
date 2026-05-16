import { mulberry32 } from "@/lib/prng";
import type { Day } from "@/types/microcms";

export type GalleryQuote = { id: string; text: string };

export type GalleryItem =
  | { kind: "photo"; day: Day }
  | { kind: "quote"; id: string; text: string };

// 写真リストと tweet リストを混ぜる。総スロット数を tweetCount 個のセグメントに
// 分割し、各セグメント内で「端を避けた」位置を seeded PRNG で1つ選んで quote を
// 配置。境界を避けることで、隣接セグメントの quote 同士が連続する事態を防ぐ
// (= 「写真をはさまずに quote が連続」を構造的に排除)。
//
// 決定論性について:
//   旧実装は `Math.random()` を使っていたため、SSR の度に quote の挿入位置が
//   ぶれ → ページ遷移 (Home に戻る) のたびに gallery 全体が再シャッフルされる
//   挙動になっていた。seeded PRNG に切り替えたことで、同じ (days, tweets) を
//   渡せば常に同じ配置が返る。新しい photo / tweet が追加されると入力配列の
//   先頭が変わる ⇒ `generateGalleryLayout` 側の i 連動の zone/jitter も含めて
//   自然に再配置される (= 仕様: 「最新アイテムが変化した場合は再配置」)。
//   seed 値は gallery-layout 側の DEFAULT_SEED と独立して持つ (composition と
//   pixel layout が別ストリームになるよう異なる定数を採用)。
const COMPOSE_SEED = 11;

export function composeGalleryItems(
  days: Day[],
  tweets: GalleryQuote[],
  seed: number = COMPOSE_SEED,
): GalleryItem[] {
  const tweetCount = days.length > 0 ? Math.min(tweets.length, 10) : 0;
  const total = days.length + tweetCount;
  if (total === 0) return [];

  const rand = mulberry32(seed);
  const tweetPositions = new Set<number>();
  if (tweetCount > 0) {
    const segSize = total / tweetCount;
    for (let i = 0; i < tweetCount; i++) {
      const segStart = Math.floor(i * segSize);
      const segEnd = Math.floor((i + 1) * segSize) - 1;
      const lo = Math.min(segEnd, segStart + 1);
      const hi = Math.max(lo, segEnd - 1);
      const pos = lo + Math.floor(rand() * (hi - lo + 1));
      tweetPositions.add(pos);
    }
  }

  const items: GalleryItem[] = [];
  let dayIdx = 0;
  let tweetIdx = 0;
  for (let i = 0; i < total; i++) {
    if (tweetPositions.has(i) && tweetIdx < tweetCount) {
      const t = tweets[tweetIdx++];
      items.push({ kind: "quote", id: t.id, text: t.text });
    } else if (dayIdx < days.length) {
      items.push({ kind: "photo", day: days[dayIdx++] });
    }
  }
  return items;
}
