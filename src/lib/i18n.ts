// 2 言語 (ja / zh) の i18n 足場。
//
// ルーティング: middleware が URL の /zh 接頭辞を見て locale を決め、
// Astro.locals.locale / Astro.locals.path に積む。各ページ・コンポーネント
// はそれを読んで文言とリンクを切り替える。
//
// 文言: ui 辞書 + t()。ja を正とし zh は Partial。未記入のキーは ja に
// フォールバックするので、台湾華語訳が入るまで /zh/ は日本語で描画される
// (= 流し込み待ちの足場状態)。

export const locales = ["ja", "zh"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ja";

// 言語の選択を記憶するクッキー名。フッターの言語切替で書き込み、
// middleware が最優先で読む。
export const LOCALE_COOKIE = "locale";

// フッターの言語切替リンクに出すラベル。
export const languages: Record<Locale, string> = {
  ja: "日",
  zh: "台華",
};

// <html lang> 用の BCP-47 表記。
export const htmlLang: Record<Locale, string> = {
  ja: "ja",
  zh: "zh-Hant-TW",
};

// og:locale 用 (アンダースコア区切り)。
export const ogLocale: Record<Locale, string> = {
  ja: "ja_JP",
  zh: "zh_TW",
};

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (locales as readonly string[]).includes(value);
}

// Accept-Language ヘッダ (= 訪問者の OS/ブラウザ言語) から locale を推定する。
// 優先度 (q 値) 順に走査し、最初に現れた zh* / ja* で決める。どちらも
// 無ければ既定 (ja)。
export function detectLocale(
  acceptLanguage: string | null | undefined,
): Locale {
  if (!acceptLanguage) return defaultLocale;
  const tags = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number.parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("ja")) return "ja";
  }
  return defaultLocale;
}

// locale 中立なパス (先頭 "/") を、その locale の実 URL に変換する。
// ja は接頭辞なし、zh は /zh 配下。アンカー付き ("/#about") も可。
export function localeUrl(path: string, locale: Locale): string {
  if (locale === defaultLocale) return path;
  if (path === "/") return "/zh/";
  return `/zh${path}`;
}

// --- UI 文言辞書 ----------------------------------------------------------
// 複数行の文言は "\n" 区切りで持ち、呼び出し側で split("\n") する。

const uiJa = {
  "site.description": "台湾研究者 康凱爾のポートフォリオ・雑記帳・実験場。",
  "nav.about": "About",
  "nav.echolog": "Echolog",
  "nav.works": "Works",
  "nav.contact": "Contact",
  "nav.menu": "menu",
  "nav.close": "close",
  "hero.scroll": "scroll",
  "about.bio": [
    "在野の台湾研究者。日本名は出田康一郎。",
    "日常生活と研究・創作活動を通して、内部から台湾の理解に取り組んでいる。",
    "1981年東京生まれ。2011年から台湾在住。",
    "麻布高校卒業。東京芸術大学音楽学部楽理科卒業。",
    "國立台灣師範大學文學院台灣語文學系碩士班畢業。文学修士。",
    "関心領域は台湾の思想・文化史、日本統治期文学など。",
  ].join("\n"),
  "works.tagline": [
    "指先から生まれたものたちは、私より長く息をする。",
    "私が忘れてしまった後も、誰かの本棚で、引き出しの奥で、静かに目を覚ましたままでいる。",
    "それを思うと、生み出す手がときどき震える。",
  ].join("\n"),
  "works.filter.all": "all",
  "works.filter.text": "text",
  "works.filter.music": "music",
  "works.filter.photo": "photo",
  "works.cat.text": "執筆",
  "works.cat.music": "音楽",
  "works.cat.photo": "撮影",
  "talks.label": "講演実績",
  "papers.label": "論文",
  "contact.before": "執筆 / 講演 / 取材のご依頼・協業のお誘いは",
  "contact.after": "まで。",
  "tweet.title": "Quote",
  "tweet.replyTo": "In reply to",
  "tweet.quoting": "Quoting",
  "tweet.retweeted": "Retweeted",
  "tweet.replies": "Replies",
} as const;

export type UIKey = keyof typeof uiJa;

// 台湾華語訳。未記入のキーは t() が ja にフォールバックする。
// TODO(i18n): 残りのキーも順次追記する。
const uiZh: Partial<Record<UIKey, string>> = {
  "about.bio": [
    "在野台灣研究者。日本名為出田康一郎。",
    "透過日常生活與研究、創作活動，致力於從內部理解台灣。",
    "1981年生於東京。2011年起定居台灣。",
    "麻布高中畢業。東京藝術大學音樂學部樂理科畢業。",
    "國立台灣師範大學文學院台灣語文學系碩士班畢業。文學碩士。",
    "關注領域為台灣思想與文化史、日治時期文學等。",
  ].join("\n"),
  "works.cat.text": "寫作",
  "works.cat.music": "音樂",
  "works.cat.photo": "攝影",
  "talks.label": "演講",
  // contact.before + メールリンク + contact.after の順で描画される。
  "contact.before": "撰稿、演講、採訪與合作邀約，歡迎來信至",
  "contact.after": "。",
};

const ui: Record<Locale, Partial<Record<UIKey, string>>> = {
  ja: uiJa,
  zh: uiZh,
};

export function t(locale: Locale, key: UIKey): string {
  return ui[locale][key] ?? uiJa[key];
}

// 複数行文言を行配列で受け取る (about.bio / works.tagline 用)。
export function tLines(locale: Locale, key: UIKey): string[] {
  return t(locale, key).split("\n");
}

// --- ローカライズドデータ -------------------------------------------------
// works.ts などの { ja, zh } 構造から locale 値を取り出す。zh が空なら ja。

export type Localized = { ja: string; zh?: string };

export function pick(value: Localized, locale: Locale): string {
  return (locale === "zh" ? value.zh : value.ja) || value.ja;
}

// microCMS tweet の body を locale で出し分ける。zh スキーマ (bodyZh) が
// 未投入の間は ja (body) にフォールバックする。
export function localizedBody(
  tweet: { body?: string; bodyZh?: string },
  locale: Locale,
): string | undefined {
  if (locale === "zh") return tweet.bodyZh || tweet.body;
  return tweet.body;
}

// microCMS day の代替テキストを locale で出し分ける。写真は内容を持つ
// 画像なので、その言語の alt が無いときは装飾扱い (空 alt) にせず
// もう一方の言語へフォールバックする (読み上げられない方が損失が大きい)。
export function localizedAlt(
  day: { altJa?: string; altZh?: string },
  locale: Locale,
): string {
  const [primary, fallback] =
    locale === "zh" ? [day.altZh, day.altJa] : [day.altJa, day.altZh];
  return primary || fallback || "";
}
