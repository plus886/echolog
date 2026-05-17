type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

// このファイルは `export {}` でモジュール扱いになるため、グローバルな
// App / Window への型拡張は declare global の中に置く必要がある。
declare global {
  namespace App {
    interface Locals extends Runtime {
      // Cloudflare Access の JWT 検証を middleware で済ませた後、page /
      // endpoint からは Astro.locals.user で利用できる。/admin 配下は
      // middleware で必ずセットされる前提。それ以外のパスでは undefined。
      user?: {
        email: string;
        bypassed: boolean;
      };

      // i18n。middleware が全リクエストで設定する。
      //  - locale: 表示言語 (URL の /zh 接頭辞から判定)
      //  - path:   locale 接頭辞を剥がした論理パス (言語切替リンク生成用)
      locale?: import("@/lib/i18n").Locale;
      path?: string;
    }
  }

  // Public layout で SmoothScroll Island が起動した Lenis インスタンスを
  // 他の Island (WordmarkLink / QuoteImages / ScrollMemory) から触れるよう、
  // window に露出させている。reduced-motion 環境では undefined のまま。
  interface Window {
    __lenis?: import("lenis").default;
  }
}

export {};
