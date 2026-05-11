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
const ASPECT = 4 / 3;
const BOTTOM_MARGIN = 320;

// Seed は index 連動の安定性が欲しいので固定値。コンテンツ追加時にレイアウト
// 全体が再シャッフルされない方が望ましい。
const DEFAULT_SEED = 6;

export function generatePlateLayout(
  count: number,
  seed: number = DEFAULT_SEED,
): { plates: Plate[]; totalHeight: number } {
  if (count <= 0) return { plates: [], totalHeight: 0 };

  const rand = mulberry32(seed);
  const plates: Plate[] = [];
  let top = FIRST_TOP;
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

    plates.push({ left: `${leftPct.toFixed(1)}%`, top, w });

    const estHeight = w * ASPECT;
    if (top + estHeight > maxBottom) maxBottom = top + estHeight;

    const step = ROW_BASE + (rand() * 2 - 1) * ROW_JITTER;
    top += Math.round(step);
  }

  return { plates, totalHeight: Math.round(maxBottom + BOTTOM_MARGIN) };
}
