// (works) セクションのモックデータ。Home の thumbnail grid + 論文リスト、
// /works/[id] の detail page が参照する単一ソース。
//
// 画像は public/works/ に置いた静的ファイルを参照する。category は Home の
// filter (ALL / TEXT / MUSIC / PHOTO) の出し分けキー。detail page では
// description / url も使う。
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

// public/works/ の静的画像。ビルドのハッシュに依存しない安定パス。
const IMG = {
  taiwan: "/works/taiwan.jpg",
  fluonika: "/works/fluonika.jpg",
  gardener: "/works/gardener.jpg",
  retrotica: "/works/retrotica.jpg",
  threeflowers: "/works/threeflowers.jpg",
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
      ja: "しばしば「複雑」の一言で流され、直視されることなく、都合よく単純化されてきた日本と台湾の関係性。その複雑さは、一体どこまで誠実な言葉にすることが可能なのだろうか？ 台湾人と共に生きざるを得ない私自身が、その複雑さを他者の言葉を通して学び、再度読み換えていく過程として記した。",
      zh: "日本與臺灣之間的關係，時常被一句「複雜」輕輕帶過；它未曾被真正直視，卻又不斷被方便地簡化。那麼，這份複雜究竟能在多大程度上，被轉化為誠實的語言呢？本書所記下的，正是不得不與臺灣人一同生活下去的我，透過他者的語言學習這份複雜，並再次加以重新閱讀的過程。",
    },
  },
  {
    id: "fluonika",
    url: "https://open.spotify.com/intl-ja/artist/5taUCZrwq5k8PDarTV56yP?si=9MM1pzkpQISgOvwX8H8jxg",
    title: { ja: "Fluonika" },
    year: "2024 —",
    category: "music",
    src: IMG.fluonika,
    description: {
      ja: "「Beyond sound, where words fade.」を合言葉に掲げるLo-Fiビートプロジェクト。快楽や身体性へと収斂しがちなビートメイクの磁場から一歩退き、古典音楽が滲ませてきた詩情と精神性をローファイの低解像度に閉じ込めようと試みた。音だけでも言葉だけでもたどり着くことのできないその地平には、どんな光景が広がっているのだろうか。",
      zh: "以「Beyond sound, where words fade.」為暗號的 Lo-Fi Beat 企劃。它試圖從往往收束於快感與身體性的 beat making 磁場中退後一步，將古典音樂長久以來滲出的詩情與精神性，封存於 Lo-Fi 的低解析度之中。在那片無法僅憑聲音、也無法僅憑語言抵達的地平線上，究竟會展開怎樣的風景呢。",
    },
  },
  {
    id: "gardener",
    url: "https://gardener.kokaiji.tw/",
    title: { ja: "庭師", zh: "園丁" },
    year: "2021",
    category: "music",
    src: IMG.gardener,
    description: {
      ja: "音楽詩集「庭師」は、即興のなかでこぼれ落ちた8つの「音楽になれない音楽」に、作者自身のことばを器として添えた、ピアノソロによる静かな連作である。一篇の旋律に一篇の散文が寄り添い、童話的な遠景と私的な追憶のあいだを往還しながら、聴く者の内側にひとつの庭を植えていく。やがてその庭をめぐる旅人の姿は、運命を「うっかり」受け入れ、帰り道を失った者の肖像へと、静かに収斂してゆく。",
      zh: "音樂詩集《園丁》是一組靜謐的鋼琴獨奏連作。它為即興之中不經意灑落的八首「無法成為音樂的音樂」，添上作者自身的文字作為容器。一篇旋律伴隨一篇散文，在童話般的遠景與私人的追憶之間往返，於聆聽者心中種下一座庭園。最終，圍繞那座庭園而行的旅人身影，將靜靜地收束為一幅肖像：那是一個「不小心」接受了命運，並失去了歸途之人的肖像。",
    },
  },
  {
    id: "formosa-chiaroscuro",
    url: "https://photo.kokaiji.tw/",
    title: { ja: "翳光臺灣" },
    year: "2024 —",
    category: "photo",
    src: IMG.retrotica,
    description: {
      ja: "台湾人の家族と共に生きる日本人による写真日誌。日々のなかに身を置く者だけが見出しうる微かな翳りと美しさを、生活の風景と街路のあわいから掬いあげ、一枚と短い言葉のかたちで綴っていく。光と影が分かちがたく重なり合うこの島の貌を、外から訪れた目と、内に生きる足とのあいだから、静かに眺めなおす試みである。",
      zh: "由一位與臺灣人家族共同生活的日本人所書寫的攝影日誌。它從生活風景與街道路徑的縫隙之間，掬起唯有置身於日常之中者才能察覺的微微陰影與美，並以一張照片與短短幾句文字記錄下來。這是一項靜靜重新凝視的嘗試：在外來者的目光與生活於其中的步伐之間，再次望向這座光與影難以分割、彼此重疊之島的面貌。",
    },
  },
  {
    id: "three-flowers",
    url: "https://www.youtube.com/@formosaandthreeflowers8476",
    title: { ja: "台湾と三つの花", zh: "台灣與三朵花" },
    year: "2020",
    category: "photo",
    src: IMG.threeflowers,
    description: {
      ja: "流れ着いた土地で、いつしか三輪の花に水をやる者となった眼が、日々のひとこまを三分ほどの時間に編み、そこに一篇のピアノが寄り添う。土地に堆積する記憶と、異邦の身に降り積もる追憶とが、ひとつの光のなかでゆっくりと溶け合っていく、その移ろいの手触りを、映像と音のふたつの時間が並走しながら、静かに描き出していく。",
      zh: "流落至此地之後，不知不覺成為為三朵花澆水之人的那雙眼，將日常的一個片刻編織成約莫三分鐘的時間，並讓一篇鋼琴之聲靜靜依偎其旁。堆積於土地之中的記憶，與降落在異鄉之身上的追憶，在同一道光裡緩緩交融——影像與聲音這兩種時間並肩流動，靜靜描繪出那份流轉變化的觸感。",
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

// 講演実績。論文リストの上に並べる。
// 論文と違い開催地・団体名は言語ごとに書き分けるので Localized で持つ
// (when は年月、where は開催地・団体)。新しい順ではなく時系列順。
export type Talk = {
  when: Localized;
  where: Localized;
};

export const talks: Talk[] = [
  {
    when: { ja: "2025年11月", zh: "2025年11月" },
    where: {
      ja: "台湾・台北旭日ロータリークラブ にて",
      zh: "臺灣・台北旭日扶輪社",
    },
  },
  {
    when: { ja: "2026年7月", zh: "2026年7月" },
    where: { ja: "日本・法政大学 にて", zh: "日本・法政大學" },
  },
];
