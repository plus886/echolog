import { mulberry32 } from "@/lib/prng";

export type Slot = {
  // 理想 (clamp 前) の center % 値。runtime に CSS clamp() で左右端余白を
  // 確保しつつ、広い viewport ではそのまま反映される。
  leftPct: number;
  top: number;
  w: number;
  h: number;
  // true なら縦書き (writing-mode: vertical-rl)。photo / 横書き quote では undefined。
  vertical?: boolean;
  // ランダムに parallax 効果を adoption する。true の slot は markup で
  // data-parallax 属性を付与し、GalleryParallax の RAF が --k-parallax-y
  // を update する。false の slot は属性なし → CSS var 未設定 → translateY(0)。
  parallax?: boolean;
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

// 縦書き quote (writing-mode: vertical-rl)。高さを 220–300 で振り、本文の
// 文字数から必要なカラム数を逆算して幅を決める。短文は縦書きにしない。
const VERTICAL_CHANCE = 0.38;
const QUOTE_V_HEIGHT_MIN = 220;
const QUOTE_V_HEIGHT_MAX = 300;
const QUOTE_V_CHAR_PX = 16; // 1文字あたりの縦方向占有 (= font-size)
const QUOTE_V_COL_WIDTH = 30; // 1カラム幅 (= font-size × line-height)
const QUOTE_V_PADDING = 10;
const QUOTE_V_MIN_CHARS = 20;

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

// Parallax 抽選確率と抽選用 seed offset。layout 用 PRNG とは独立した stream
// を使うことで、parallax の確率を変えても座標が動かない (= position は完全に
// stable、parallax decision だけが変わる) ようにする。
const PARALLAX_PROB = 0.5;
const PARALLAX_SEED_OFFSET = 7919; // 大きめの素数で seed 空間をシフト

export function generateGalleryLayout(
  items: LayoutItem[],
  seed: number = DEFAULT_SEED,
): { slots: Slot[]; totalHeight: number } {
  const count = items.length;
  if (count <= 0) return { slots: [], totalHeight: 0 };

  const rand = mulberry32(seed);
  const parallaxRand = mulberry32((seed + PARALLAX_SEED_OFFSET) >>> 0);
  const slots: Slot[] = [];
  let nextTop = FIRST_TOP;
  let maxBottom = 0;

  for (let i = 0; i < count; i++) {
    const item = items[i];
    const zone = ZONE_CENTERS[i % ZONE_CENTERS.length];
    const leftPct = zone + (rand() * 2 - 1) * ZONE_JITTER;

    let w: number;
    let h: number;
    let vertical = false;
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
      // quote: rand() を 2 回消費する (向き判定 + 幅または高さ選択)。
      vertical = item.chars >= QUOTE_V_MIN_CHARS && rand() < VERTICAL_CHANCE;
      if (vertical) {
        h = Math.round(
          QUOTE_V_HEIGHT_MIN +
            rand() * (QUOTE_V_HEIGHT_MAX - QUOTE_V_HEIGHT_MIN),
        );
        const charsPerCol = Math.max(
          1,
          Math.floor((h - 2 * QUOTE_V_PADDING) / QUOTE_V_CHAR_PX),
        );
        const cols = Math.max(1, Math.ceil(item.chars / charsPerCol));
        w = cols * QUOTE_V_COL_WIDTH + 2 * QUOTE_V_PADDING;
      } else {
        w = Math.round(
          QUOTE_WIDTH_MIN + rand() * (QUOTE_WIDTH_MAX - QUOTE_WIDTH_MIN),
        );
        const charsPerLine = Math.max(1, Math.floor(w / QUOTE_CHAR_PX));
        const lines = Math.max(1, Math.ceil(item.chars / charsPerLine));
        h = lines * QUOTE_LINE_HEIGHT + QUOTE_VPAD * 2;
      }
    }

    // 衝突判定用の座標は「狭い viewport で clamp() が効いた後の位置」を
    // 想定する。これにより narrow ですれ違うアイテムも no-overlap が保証
    // され、wide で peripheral 復活時には更に離れるだけなので安全。
    const halfWidthPct = (w / ASSUMED_CONTAINER_W) * 50;
    const minLeftPct = SAFE_MARGIN_PCT + halfWidthPct;
    const maxLeftPct = 100 - SAFE_MARGIN_PCT - halfWidthPct;
    const clampedLeftPct = Math.max(minLeftPct, Math.min(maxLeftPct, leftPct));

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

    const parallax = parallaxRand() < PARALLAX_PROB;
    slots.push(
      vertical
        ? { leftPct, top, w, h, vertical, parallax }
        : { leftPct, top, w, h, parallax },
    );

    if (top + h > maxBottom) maxBottom = top + h;

    const step = ROW_BASE + (rand() * 2 - 1) * ROW_JITTER;
    nextTop = top + Math.round(step);
  }

  return { slots, totalHeight: Math.round(maxBottom + BOTTOM_MARGIN) };
}

// ─────────────────────────────────────────────────────────────
// Quote image scatter (tweet 詳細ページの主ツイート直下に置く画像)
//
// Home gallery と同じ「decision-jitter + 衝突回避」を、tweet 詳細の
// 狭い列 (max-w-211 ≒ 844px、padding 込みなら ~720px) 向けに小さく
// チューニングしたバージョン。
//
// 旧実装は `<ul flex-wrap gap-3>` で 96x96 サムネを横並びにするだけ
// だった。これを Home と同じ "scattered jitter" に置き換える。
//
// 決定論性:
//   seed が同じなら同じ slot 配列を返す。呼び出し側 (tweets/[id].astro)
//   で tweet.id を `hashStringToSeed` で int に変換して seed に渡せば、
//   tweet ごとに固定 (ただしユニーク) なレイアウトになる。画像追加 /
//   差し替えなどで images[] が変わっても seed は同じだが、count や
//   aspect ratio が変わることで自然に再配置される。
// ─────────────────────────────────────────────────────────────

export type QuoteImageDim = {
  width?: number;
  height?: number;
};

export type QuoteImageSlot = {
  leftPct: number;
  top: number;
  w: number;
  h: number;
};

const QI_ASSUMED_CONTAINER_W = 720;
const QI_ZONE_JITTER = 6;
const QI_ROW_BASE = 130;
const QI_ROW_JITTER = 28;
const QI_FIRST_TOP = 0;
const QI_BOTTOM_MARGIN = 24;
const QI_WIDTH_MIN = 150;
const QI_WIDTH_MAX = 210;
const QI_MIN_GAP = 18;
// `.k-pos` の --side-margin を 0px で上書きする前提でも、画像が極端に
// 端に寄らないよう内部的に少しだけ余白を確保する。
const QI_SAFE_MARGIN_PCT = 4;
const QI_DEFAULT_SEED = 17;

function quoteImageZones(count: number): readonly number[] {
  if (count <= 1) return [50];
  if (count === 2) return [32, 68];
  return [24, 50, 76];
}

export function generateQuoteImagesLayout(
  images: QuoteImageDim[],
  seed: number = QI_DEFAULT_SEED,
): { slots: QuoteImageSlot[]; totalHeight: number } {
  const count = images.length;
  if (count === 0) return { slots: [], totalHeight: 0 };

  const rand = mulberry32(seed);
  const zones = quoteImageZones(count);
  const slots: QuoteImageSlot[] = [];
  let nextTop = QI_FIRST_TOP;
  let maxBottom = 0;

  for (let i = 0; i < count; i++) {
    const img = images[i];
    const zone = zones[i % zones.length];
    const leftPct = zone + (rand() * 2 - 1) * QI_ZONE_JITTER;

    const w = Math.round(QI_WIDTH_MIN + rand() * (QI_WIDTH_MAX - QI_WIDTH_MIN));
    const aspect =
      img.width && img.height && img.width > 0 ? img.height / img.width : 1;
    const h = Math.max(1, Math.round(w * aspect));

    // 衝突判定: Home gallery と同じ手順で、想定 container 幅における
    // bounding box を計算し、上方の slot と当たるなら下に押し下げる。
    const halfWidthPct = (w / QI_ASSUMED_CONTAINER_W) * 50;
    const minLeftPct = QI_SAFE_MARGIN_PCT + halfWidthPct;
    const maxLeftPct = 100 - QI_SAFE_MARGIN_PCT - halfWidthPct;
    const clampedLeftPct = Math.max(minLeftPct, Math.min(maxLeftPct, leftPct));
    const centerPx = (clampedLeftPct / 100) * QI_ASSUMED_CONTAINER_W;
    const leftEdge = centerPx - w / 2;
    const rightEdge = centerPx + w / 2;

    let top = nextTop;
    for (let j = i - 1; j >= 0; j--) {
      const p = slots[j];
      if (p.top + p.h + QI_MIN_GAP <= top) break;
      const pHalfPct = (p.w / QI_ASSUMED_CONTAINER_W) * 50;
      const pClamped = Math.max(
        QI_SAFE_MARGIN_PCT + pHalfPct,
        Math.min(100 - QI_SAFE_MARGIN_PCT - pHalfPct, p.leftPct),
      );
      const pCenter = (pClamped / 100) * QI_ASSUMED_CONTAINER_W;
      const pLeft = pCenter - p.w / 2;
      const pRight = pCenter + p.w / 2;
      const hOverlap =
        pRight + QI_MIN_GAP > leftEdge && pLeft - QI_MIN_GAP < rightEdge;
      if (hOverlap) {
        const minTop = p.top + p.h + QI_MIN_GAP;
        if (top < minTop) top = minTop;
      }
    }

    slots.push({ leftPct, top, w, h });
    if (top + h > maxBottom) maxBottom = top + h;

    const step = QI_ROW_BASE + (rand() * 2 - 1) * QI_ROW_JITTER;
    nextTop = top + Math.round(step);
  }

  return { slots, totalHeight: Math.round(maxBottom + QI_BOTTOM_MARGIN) };
}
