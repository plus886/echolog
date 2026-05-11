import type { Day } from "@/types/microcms";

export type GalleryItem =
  | { kind: "photo"; day: Day }
  | { kind: "quote"; text: string };

// 写真リストと tweet リストを混ぜる。総スロット数を tweetCount 個のセグメントに
// 分割し、各セグメント内で「端を避けた」位置を Math.random で1つ選んで quote を
// 配置。境界を避けることで、隣接セグメントの quote 同士が連続する事態を防ぐ
// (= 「写真をはさまずに quote が連続」を構造的に排除)。
export function composeGalleryItems(
  days: Day[],
  tweets: string[],
): GalleryItem[] {
  const tweetCount = days.length > 0 ? Math.min(tweets.length, 10) : 0;
  const total = days.length + tweetCount;
  if (total === 0) return [];

  const tweetPositions = new Set<number>();
  if (tweetCount > 0) {
    const segSize = total / tweetCount;
    for (let i = 0; i < tweetCount; i++) {
      const segStart = Math.floor(i * segSize);
      const segEnd = Math.floor((i + 1) * segSize) - 1;
      const lo = Math.min(segEnd, segStart + 1);
      const hi = Math.max(lo, segEnd - 1);
      const pos = lo + Math.floor(Math.random() * (hi - lo + 1));
      tweetPositions.add(pos);
    }
  }

  const items: GalleryItem[] = [];
  let dayIdx = 0;
  let tweetIdx = 0;
  for (let i = 0; i < total; i++) {
    if (tweetPositions.has(i) && tweetIdx < tweetCount) {
      items.push({ kind: "quote", text: tweets[tweetIdx++] });
    } else if (dayIdx < days.length) {
      items.push({ kind: "photo", day: days[dayIdx++] });
    }
  }
  return items;
}
