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

export type Slot = {
  // 理想 (clamp 前) の center % 値。runtime に CSS clamp() で左右端余白を
  // 確保しつつ、広い viewport ではそのまま反映される。
  leftPct: number;
  top: number;
  w: number;
  h: number;
};

export type ImageDim = {
  width: number;
  height: number;
};

export type LayoutItem =
  | { kind: "photo"; image: ImageDim }
  | { kind: "quote"; chars: number };

// ---- Photo (plate) ----
const ZONE_CENTERS = [24, 50, 76] as const;
const ZONE_JITTER = 8;
const ROW_BASE = 200;
const ROW_JITTER = 40;
const WIDTH_MIN = 140;
const WIDTH_MAX = 190;
const WIDTH_WIDE_CHANCE = 0.18;
const WIDTH_WIDE_BONUS = 12;
const FIRST_TOP = 280;
const BOTTOM_MARGIN = 320;

// ---- Quote (text) ----
// 横幅が狭すぎると不格好になるので最低 280 を確保。最大 460 まで広めに振れる。
// 高さは「1行に入る文字数 → 行数 → 行送り」で見積もる。
const QUOTE_WIDTH_MIN = 280;
const QUOTE_WIDTH_MAX = 460;
const QUOTE_CHAR_PX = 14;
const QUOTE_LINE_HEIGHT = 26;
const QUOTE_VPAD = 12;

// 衝突判定は「サポートする最も狭い desktop viewport」を想定した座標空間で
// 行う。そこで重ならなければ、CSS clamp() が広い viewport で peripheral を
// 解放しても (= 横方向に更に離れる) 重なりは増えないので問題ない。
const ASSUMED_CONTAINER_W = 1000;
const MIN_GAP = 20;
// 衝突判定時に leftPct を clamp する境界。実際の DOM の left は CSS 側の
// clamp() が runtime に同じ意味の制約を viewport-aware に評価する。
const SAFE_MARGIN_PCT = 6;

// Seed は index 連動の安定性が欲しいので固定値。コンテンツ追加時にレイアウト
// 全体が再シャッフルされない方が望ましい。
const DEFAULT_SEED = 6;

export function generateGalleryLayout(
  items: LayoutItem[],
  seed: number = DEFAULT_SEED,
): { slots: Slot[]; totalHeight: number } {
  const count = items.length;
  if (count <= 0) return { slots: [], totalHeight: 0 };

  const rand = mulberry32(seed);
  const slots: Slot[] = [];
  let nextTop = FIRST_TOP;
  let maxBottom = 0;

  for (let i = 0; i < count; i++) {
    const item = items[i];
    const zone = ZONE_CENTERS[i % ZONE_CENTERS.length];
    const leftPct = zone + (rand() * 2 - 1) * ZONE_JITTER;

    let w: number;
    let h: number;
    if (item.kind === "photo") {
      const wide = rand() < WIDTH_WIDE_CHANCE;
      w = Math.round(
        WIDTH_MIN +
          rand() * (WIDTH_MAX - WIDTH_MIN) +
          (wide ? WIDTH_WIDE_BONUS : 0),
      );
      const img = item.image;
      const aspect = img.width > 0 ? img.height / img.width : 1;
      h = Math.max(1, Math.round(w * aspect));
    } else {
      // quote: 1 rand() しか消費しない (photo は wide 用に +1)。シーケンスを
      // 揃えるため空消費はしない。これによりレイアウトは items 内の photo/
      // quote 構成に応じて変化する。
      w = Math.round(
        QUOTE_WIDTH_MIN + rand() * (QUOTE_WIDTH_MAX - QUOTE_WIDTH_MIN),
      );
      const charsPerLine = Math.max(1, Math.floor(w / QUOTE_CHAR_PX));
      const lines = Math.max(1, Math.ceil(item.chars / charsPerLine));
      h = lines * QUOTE_LINE_HEIGHT + QUOTE_VPAD * 2;
    }

    // 衝突判定用の座標は「狭い viewport で clamp() が効いた後の位置」を
    // 想定する。これにより narrow ですれ違うアイテムも no-overlap が保証
    // され、wide で peripheral 復活時には更に離れるだけなので安全。
    const halfWidthPct = (w / ASSUMED_CONTAINER_W) * 50;
    const minLeftPct = SAFE_MARGIN_PCT + halfWidthPct;
    const maxLeftPct = 100 - SAFE_MARGIN_PCT - halfWidthPct;
    const clampedLeftPct = Math.max(
      minLeftPct,
      Math.min(maxLeftPct, leftPct),
    );

    const centerPx = (clampedLeftPct / 100) * ASSUMED_CONTAINER_W;
    const leftEdge = centerPx - w / 2;
    const rightEdge = centerPx + w / 2;

    // 直近 slot から順に上方向へ走査して垂直に届く範囲のものを bounding
    // box で当たり判定。重なるなら top を minTop まで押し下げる。
    // 上方の slot の center は当時 clamp したものを再計算して比較。
    let top = nextTop;
    for (let j = i - 1; j >= 0; j--) {
      const p = slots[j];
      if (p.top + p.h + MIN_GAP <= top) break;
      const pHalfPct = (p.w / ASSUMED_CONTAINER_W) * 50;
      const pClamped = Math.max(
        SAFE_MARGIN_PCT + pHalfPct,
        Math.min(100 - SAFE_MARGIN_PCT - pHalfPct, p.leftPct),
      );
      const pCenter = (pClamped / 100) * ASSUMED_CONTAINER_W;
      const pLeft = pCenter - p.w / 2;
      const pRight = pCenter + p.w / 2;
      const hOverlap =
        pRight + MIN_GAP > leftEdge && pLeft - MIN_GAP < rightEdge;
      if (hOverlap) {
        const minTop = p.top + p.h + MIN_GAP;
        if (top < minTop) top = minTop;
      }
    }

    slots.push({ leftPct, top, w, h });

    if (top + h > maxBottom) maxBottom = top + h;

    const step = ROW_BASE + (rand() * 2 - 1) * ROW_JITTER;
    nextTop = top + Math.round(step);
  }

  return { slots, totalHeight: Math.round(maxBottom + BOTTOM_MARGIN) };
}
