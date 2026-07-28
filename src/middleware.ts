import { defineMiddleware } from "astro:middleware";

import {
  ACCESS_COOKIE,
  ACCESS_EMAIL_HEADER,
  ACCESS_JWT_HEADER,
  verifyAccess,
} from "@/lib/access";
import {
  defaultLocale,
  detectLocale,
  isLocale,
  type Locale,
  LOCALE_COOKIE,
} from "@/lib/i18n";

// 認証ゲート + i18n ロケール解決を担う middleware。
//
// i18n: 公開ページは /zh 接頭辞で台湾華語、無印で日本語。接頭辞付きの
// リクエストは接頭辞を剥がした論理パスへ rewrite し、全ページファイルを
// 単一に保つ (locale 別のページ複製はしない)。/admin・/api は接頭辞を
// 持たない (公開ページのみ2言語)。
//
// 言語ネゴシエーション: /zh 接頭辞なしの公開パスでは、訪問者の好む言語が
// zh なら /zh へ 302 する。優先度は locale クッキー (明示選択) >
// Accept-Language (OS/ブラウザ言語) > 既定 ja。/zh URL は明示的なので
// そのまま (zh→ja の自動リダイレクトはしない)。
//
// 旧 matcher: ["/admin", "/admin/:path*", "/api/og-preview", "/api/uploads"]
function requiresAuth(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  // Astro Actions は全て admin 専用の操作 (投稿・削除・生成) なので一律
  // 認証必須。ここを外すと本番で /_actions/* が未認証のまま直接叩ける。
  if (pathname.startsWith("/_actions")) return true;
  if (pathname.startsWith("/api/admin/")) return true;
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

    const isZhPath = pathname === "/zh" || pathname.startsWith("/zh/");
    const isAdminOrApi =
      pathname.startsWith("/admin") || pathname.startsWith("/api");

    // 接頭辞なしの公開パスは、好む言語が zh なら /zh へリダイレクトする。
    if (!isZhPath && !isAdminOrApi) {
      const saved = context.cookies.get(LOCALE_COOKIE)?.value;
      const preferred = isLocale(saved)
        ? saved
        : detectLocale(context.request.headers.get("accept-language"));
      if (preferred === "zh") {
        return context.redirect(`/zh${pathname}${context.url.search}`, 302);
      }
    }

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
    // Cloudflare Access が JWT ヘッダを注入するのは Access application の
    // パス (kokaiji.tw/admin*) に一致したリクエストのみ。admin ページから
    // fetch される /_actions・/api/* にはヘッダが付かないが、Access ログイン
    // 時にドメインへ発行される CF_Authorization クッキーが同じ JWT を運ぶ
    // ので、ヘッダ → クッキーの順で取り出して検証する (検証自体は同一)。
    const jwt =
      context.request.headers.get(ACCESS_JWT_HEADER) ??
      context.cookies.get(ACCESS_COOKIE)?.value;
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
