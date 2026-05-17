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
  "site.description": "echo + log — 自分の発信が積み重なっていく場所",
  "nav.about": "About",
  "nav.echolog": "Echolog",
  "nav.works": "Works",
  "nav.contact": "Contact",
  "nav.menu": "menu",
  "nav.close": "close",
  "hero.scroll": "scroll",
  "about.bio": [
    "台湾研究者。",
    "日本名は出田康一郎。",
    "専門は台湾思想・台湾文化論。",
    "1981年東京生まれ。",
    "東京芸術大学音楽学部楽理科卒業。",
    "國立台灣師範大學台灣語文學系碩士班在籍中。",
    "2011年から台湾在住。",
  ].join("\n"),
  "works.tagline": [
    "指先から生まれたものたちは、わたしより長く息をする。",
    "わたしが忘れてしまった後も、誰かの本棚で、引き出しの奥で、静かに目を覚ましたままでいる。",
    "それを想うと、生み出す手がときどき震える。",
  ].join("\n"),
  "works.filter.all": "all",
  "works.filter.text": "text",
  "works.filter.music": "music",
  "works.filter.photo": "photo",
  "works.cat.text": "執筆",
  "works.cat.music": "音楽",
  "works.cat.photo": "撮影",
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

// TODO(i18n): 台湾華語訳をここに追記する。未記入のキーは ja を表示。
const uiZh: Partial<Record<UIKey, string>> = {};

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
