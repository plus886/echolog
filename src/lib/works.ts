// (works) セクションのモックデータ。Home の thumbnail grid と
// /works/[id] の detail page の両方が参照する単一ソース。
//
// 画像 src は kokaiji.tw の asset URL を仮置き (後で public/works/ に
// 移植予定)。category は Home の filter (ALL / TEXT / MUSIC / PHOTO) の
// 出し分けキー。detail 用に description / meta / gallery を持つ。

export type WorkCat = "text" | "music" | "photo";

export type WorkMeta = { label: string; value: string };
export type WorkImage = { src: string; aspect: string };

export type Work = {
  id: string;
  title: string;
  subtitle?: string;
  year: string;
  category: WorkCat;
  src: string;
  aspect: string;
  description: string;
  url: string; // 外部参考 URL
  meta: WorkMeta[];
  gallery: WorkImage[];
};

// 仮画像 (kokaiji.tw asset)。detail gallery は数が要るので使い回す。
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
    title: "日本人のための台湾学入門（平凡社新書）",
    subtitle: "平凡社新書",
    year: "2025",
    category: "text",
    src: IMG.taiwan,
    aspect: "3 / 4",
    description:
      "しばしば「複雑」の一言で流され、直視されることなく、都合よく単純化されてきた日本と台湾の関係性。その複雑さは、一体どこまで誠実な言葉にすることが可能なのだろうか？ 台湾人と共に生きざるを得ない私自身が、その複雑さを、他者の言葉を通して学び、再度読み換えていく過程として記した。",
    meta: [
      { label: "媒体", value: "書籍" },
      { label: "版元", value: "平凡社新書" },
      { label: "発売", value: "2025.04" },
      { label: "判型", value: "新書判 256p" },
    ],
    gallery: [
      { src: IMG.taiwan, aspect: "3 / 4" },
      { src: IMG.threeflowers, aspect: "4 / 3" },
      { src: IMG.retrotica, aspect: "3 / 4" },
    ],
  },
  {
    id: "fluonika",
    url: "https://fluonika.bandcamp.com",
    title: "Fluonika",
    subtitle: "フルオニカ",
    year: "2024 —",
    category: "music",
    src: IMG.fluonika,
    aspect: "4 / 3",
    description:
      "蛍光 (fluo) と調べ (-nika) を綴じた名のもとに始まった音楽プロジェクト。台北の湿った夜気や、明滅するネオンの残像を音の手触りに置き換えていく。作曲・編曲を担当し、現在も継続して制作中。",
    meta: [
      { label: "媒体", value: "音楽" },
      { label: "形態", value: "バンド・プロジェクト" },
      { label: "担当", value: "作曲・編曲" },
      { label: "始動", value: "2024" },
    ],
    gallery: [
      { src: IMG.fluonika, aspect: "4 / 3" },
      { src: IMG.gardener, aspect: "3 / 4" },
      { src: IMG.retrotica, aspect: "3 / 4" },
    ],
  },
  {
    id: "gardener",
    url: "https://soundcloud.com/kokaiji/gardener",
    title: "Gardener",
    subtitle: "庭師",
    year: "2021",
    category: "music",
    src: IMG.gardener,
    aspect: "3 / 4",
    description:
      "手をかけ、待ち、また手をかける——庭師の所作を時間の比喩として置いた一曲。育てたものはやがて作り手より長く息をする、というモチーフを、抑えた編成と長い余韻で綴った。作詞・作曲を担当。",
    meta: [
      { label: "媒体", value: "音楽" },
      { label: "形態", value: "楽曲" },
      { label: "担当", value: "作詞・作曲" },
      { label: "発表", value: "2021" },
    ],
    gallery: [
      { src: IMG.gardener, aspect: "3 / 4" },
      { src: IMG.fluonika, aspect: "4 / 3" },
      { src: IMG.threeflowers, aspect: "4 / 3" },
    ],
  },
  {
    id: "formosa-chiaroscuro",
    url: "https://kokaiji.tw/works/formosa-chiaroscuro",
    title: "翳光臺灣",
    subtitle: "Formosa Chiaroscuro",
    year: "2024 —",
    category: "photo",
    src: IMG.retrotica,
    aspect: "3 / 4",
    description:
      "陰翳 (chiaroscuro) を主題に台湾各地を歩いた写真プロジェクト。強い光ではなく、その光が落とす翳りのほうに島の質感を探す。路地、廟、市場——日常の片隅に沈む明暗を継続的に撮り続けている。",
    meta: [
      { label: "媒体", value: "写真" },
      { label: "形態", value: "シリーズ・個展" },
      { label: "会場", value: "台北" },
      { label: "会期", value: "2024 —" },
    ],
    gallery: [
      { src: IMG.retrotica, aspect: "3 / 4" },
      { src: IMG.threeflowers, aspect: "4 / 3" },
      { src: IMG.taiwan, aspect: "3 / 4" },
    ],
  },
  {
    id: "three-flowers",
    url: "https://kokaiji.tw/works/three-flowers",
    title: "Formosa and Three Flowers",
    subtitle: "台湾と三つの花",
    year: "2020",
    category: "photo",
    src: IMG.threeflowers,
    aspect: "4 / 3",
    description:
      "台湾を象徴する三つの花を軸に、島の四季と人の暮らしを編んだ写真集。植物の生のリズムに寄り添いながら、土地の記憶をゆっくりとたどる。撮影・構成を担当した初期作品。",
    meta: [
      { label: "媒体", value: "写真" },
      { label: "形態", value: "写真集" },
      { label: "発行", value: "2020" },
      { label: "担当", value: "撮影・構成" },
    ],
    gallery: [
      { src: IMG.threeflowers, aspect: "4 / 3" },
      { src: IMG.retrotica, aspect: "3 / 4" },
      { src: IMG.fluonika, aspect: "4 / 3" },
    ],
  },
];

export function getWork(id: string): Work | undefined {
  return works.find((w) => w.id === id);
}
