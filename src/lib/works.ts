// (works) セクションのモックデータ。Home の thumbnail grid + 論文リスト、
// /works/[id] の detail page が参照する単一ソース。
//
// 画像 src は kokaiji.tw の asset URL を仮置き (後で public/works/ に
// 移植予定)。category は Home の filter (ALL / TEXT / MUSIC / PHOTO) の
// 出し分けキー。detail page では description / url も使う。
// papers は Works グリッド下に並べるテキストのみの発表論文リスト。
//
// i18n: title / description は { ja, zh } 構造。zh は未記入なら pick() が
// ja にフォールバックする (台湾華語訳は後で流し込む)。year は言語中立、
// papers は学術論文の原語タイトルなので言語中立として単一文字列のまま。

import type { Localized } from "@/lib/i18n";

export type WorkCat = "text" | "music" | "photo";

export type Work = {
  id: string;
  title: Localized;
  year: string;
  category: WorkCat;
  src: string;
  description: Localized;
  url: string; // 外部参考 URL
};

// 仮画像 (kokaiji.tw asset)。
const IMG = {
  taiwan: "https://kokaiji.tw/_astro/taiwan.jleloxE5_gGKlp.webp",
  fluonika: "https://kokaiji.tw/_astro/fluonika.CAJuWOQX_Z2wT6uW.webp",
  gardener: "https://kokaiji.tw/_astro/gardener.Bu3MoHOv_TkyES.webp",
  retrotica: "https://kokaiji.tw/_astro/retrotica.B2Sx7-yf_1VJ1de.webp",
  threeflowers: "https://kokaiji.tw/_astro/threeflowers.CIOSeB1O_1PFhf0.webp",
} as const;

export const works: Work[] = [
  {
    id: "taiwan",
    url: "https://www.heibonsha.co.jp/book/b662221.html",
    title: { ja: "日本人のための台湾学入門（平凡社新書）" },
    year: "2025",
    category: "text",
    src: IMG.taiwan,
    description: {
      ja: "しばしば「複雑」の一言で流され、直視されることなく、都合よく単純化されてきた日本と台湾の関係性。その複雑さは、一体どこまで誠実な言葉にすることが可能なのだろうか？ 台湾人と共に生きざるを得ない私自身が、その複雑さを、他者の言葉を通して学び、再度読み換えていく過程として記した。",
    },
  },
  {
    id: "fluonika",
    url: "https://fluonika.bandcamp.com",
    title: { ja: "Fluonika" },
    year: "2024 —",
    category: "music",
    src: IMG.fluonika,
    description: {
      ja: "蛍光 (fluo) と調べ (-nika) を綴じた名のもとに始まった音楽プロジェクト。台北の湿った夜気や、明滅するネオンの残像を音の手触りに置き換えていく。作曲・編曲を担当し、現在も継続して制作中。",
    },
  },
  {
    id: "gardener",
    url: "https://soundcloud.com/kokaiji/gardener",
    title: { ja: "庭師" },
    year: "2021",
    category: "music",
    src: IMG.gardener,
    description: {
      ja: "手をかけ、待ち、また手をかける——庭師の所作を時間の比喩として置いた一曲。育てたものはやがて作り手より長く息をする、というモチーフを、抑えた編成と長い余韻で綴った。作詞・作曲を担当。",
    },
  },
  {
    id: "formosa-chiaroscuro",
    url: "https://kokaiji.tw/works/formosa-chiaroscuro",
    title: { ja: "翳光臺灣" },
    year: "2024 —",
    category: "photo",
    src: IMG.retrotica,
    description: {
      ja: "陰翳 (chiaroscuro) を主題に台湾各地を歩いた写真プロジェクト。強い光ではなく、その光が落とす翳りのほうに島の質感を探す。路地、廟、市場——日常の片隅に沈む明暗を継続的に撮り続けている。",
    },
  },
  {
    id: "three-flowers",
    url: "https://kokaiji.tw/works/three-flowers",
    title: { ja: "台湾と三つの花" },
    year: "2020",
    category: "photo",
    src: IMG.threeflowers,
    description: {
      ja: "台湾を象徴する三つの花を軸に、島の四季と人の暮らしを編んだ写真集。植物の生のリズムに寄り添いながら、土地の記憶をゆっくりとたどる。撮影・構成を担当した初期作品。",
    },
  },
];

export function getWork(id: string): Work | undefined {
  return works.find((w) => w.id === id);
}

// 発表論文。サムネイル等は持たず、引用テキストのみ。
// title は篇名 (〈〉込み)、source は掲載誌・巻号 (《》込み)。
// 学術論文の原語タイトルなので言語中立 (locale で出し分けない)。
export type Paper = {
  title: string;
  source: string;
};

export const papers: Paper[] = [
  {
    title: "《「異身同體之夢」殘響 ── 呂赫若後期小說的殖民地臺灣「共在」》",
    source: "國立台灣師範大學台灣語文學系碩士論文",
  },
  {
    title:
      "〈不在的臉與殘響的場域 ── 呂赫若〈玉蘭花〉中的照片、庭院與香氣偏位〉",
    source: "《台灣文學研究雧刊》第 35 期",
  },
];
