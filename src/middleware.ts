import { defineMiddleware } from "astro:middleware";

import {
  ACCESS_EMAIL_HEADER,
  ACCESS_JWT_HEADER,
  verifyAccess,
} from "@/lib/access";
import { defaultLocale, type Locale } from "@/lib/i18n";

// 認証ゲート + i18n ロケール解決を担う middleware。
//
// i18n: 公開ページは /zh 接頭辞で台湾華語、無印で日本語。接頭辞付きの
// リクエストは接頭辞を剥がした論理パスへ rewrite し、全ページファイルを
// 単一に保つ (locale 別のページ複製はしない)。/admin・/api は接頭辞を
// 持たない (公開ページのみ2言語)。
//
// 旧 matcher: ["/admin", "/admin/:path*", "/api/og-preview", "/api/uploads"]
function requiresAuth(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/api/og-preview") return true;
  if (pathname === "/api/uploads") return true;
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  // rewrite 後の再入では locale は決定済み。locals は同一リクエスト内で
  // 保持されるので、再判定して ja に上書きしてしまうのを防ぐ。
  const isReentry = context.locals.locale !== undefined;

  if (!isReentry) {
    const { pathname } = context.url;
    let locale: Locale = defaultLocale;
    let logicalPath = pathname;

    if (pathname === "/zh" || pathname.startsWith("/zh/")) {
      const stripped = pathname.slice(3) || "/";
      // /zh/admin・/zh/api は無効 (接頭辞対象外) なので剥がさない。
      if (!stripped.startsWith("/admin") && !stripped.startsWith("/api")) {
        locale = "zh";
        logicalPath = stripped;
      }
    }

    context.locals.locale = locale;
    context.locals.path = logicalPath;

    if (locale === "zh" && logicalPath !== pathname) {
      return context.rewrite(logicalPath + context.url.search);
    }
  }

  // 認証ゲートは論理パス (接頭辞なし) で判定する。
  const authPath = context.locals.path ?? context.url.pathname;
  if (requiresAuth(authPath)) {
    const jwt = context.request.headers.get(ACCESS_JWT_HEADER);
    const email = context.request.headers.get(ACCESS_EMAIL_HEADER);

    const result = await verifyAccess({ jwt, email });
    if (!result.ok) {
      return new Response(
        JSON.stringify({ error: "unauthorized", reason: result.reason }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    context.locals.user = result.user;
  }

  return next();
});
