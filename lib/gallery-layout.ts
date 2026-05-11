// mulberry32 PRNG (https://github.com/bryc/code/blob/master/jshash/PRNGs.md)
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Plate = {
  left: string;
  top: number;
  w: number;
  h: number;
};

export type PlateImage = {
  width: number;
  height: number;
};

const ZONE_CENTERS = [22, 50, 78] as const;
const ZONE_JITTER = 10;
const ROW_BASE = 200;
const ROW_JITTER = 40;
const WIDTH_MIN = 140;
const WIDTH_MAX = 190;
const WIDTH_WIDE_CHANCE = 0.18;
const WIDTH_WIDE_BONUS = 12;
const FIRST_TOP = 280;
const BOTTOM_MARGIN = 320;

// 衝突判定は assumed container 幅基準で行う。実 viewport がこれより広ければ
// plate は更に離れる方向に動くので overlap の心配はない。狭い (mobile) では
// 別レイアウトが必要だが、現状の design は desktop 起点。
const ASSUMED_CONTAINER_W = 1440;
const MIN_GAP = 20;

// Seed は index 連動の安定性が欲しいので固定値。コンテンツ追加時にレイアウト
// 全体が再シャッフルされない方が望ましい。
const DEFAULT_SEED = 6;

export function generatePlateLayout(
  images: PlateImage[],
  seed: number = DEFAULT_SEED,
): { plates: Plate[]; totalHeight: number } {
  const count = images.length;
  if (count <= 0) return { plates: [], totalHeight: 0 };

  const rand = mulberry32(seed);
  const plates: Plate[] = [];
  let nextTop = FIRST_TOP;
  let maxBottom = 0;

  for (let i = 0; i < count; i++) {
    const zone = ZONE_CENTERS[i % ZONE_CENTERS.length];
    const leftPct = zone + (rand() * 2 - 1) * ZONE_JITTER;
    const wide = rand() < WIDTH_WIDE_CHANCE;
    const w = Math.round(
      WIDTH_MIN +
        rand() * (WIDTH_MAX - WIDTH_MIN) +
        (wide ? WIDTH_WIDE_BONUS : 0),
    );

    const img = images[i];
    const aspect = img.width > 0 ? img.height / img.width : 1;
    const h = Math.max(1, Math.round(w * aspect));

    const centerPx = (leftPct / 100) * ASSUMED_CONTAINER_W;
    const leftEdge = centerPx - w / 2;
    const rightEdge = centerPx + w / 2;

    // 直近 plate から順に上方向へ走査して垂直に届く範囲のものを bounding
    // box で当たり判定。重なるなら top を minTop まで押し下げる。
    let top = nextTop;
    for (let j = i - 1; j >= 0; j--) {
      const p = plates[j];
      if (p.top + p.h + MIN_GAP <= top) break;
      const pCenter = (parseFloat(p.left) / 100) * ASSUMED_CONTAINER_W;
      const pLeft = pCenter - p.w / 2;
      const pRight = pCenter + p.w / 2;
      const hOverlap =
        pRight + MIN_GAP > leftEdge && pLeft - MIN_GAP < rightEdge;
      if (hOverlap) {
        const minTop = p.top + p.h + MIN_GAP;
        if (top < minTop) top = minTop;
      }
    }

    plates.push({ left: `${leftPct.toFixed(1)}%`, top, w, h });

    if (top + h > maxBottom) maxBottom = top + h;

    const step = ROW_BASE + (rand() * 2 - 1) * ROW_JITTER;
    nextTop = top + Math.round(step);
  }

  return { plates, totalHeight: Math.round(maxBottom + BOTTOM_MARGIN) };
}
