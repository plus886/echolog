import { defineMiddleware } from "astro:middleware";

import {
  ACCESS_EMAIL_HEADER,
  ACCESS_JWT_HEADER,
  verifyAccess,
} from "@/lib/access";

// 旧 middleware.ts (Next.js) からの移植。役割は認証パスのゲートのみ。
// env の調達は cloudflare:workers から module-level import で完結する
// (lib/env.ts 参照) ため、ここで AsyncLocalStorage 等の plumbing は不要。
//
// 旧 matcher: ["/admin", "/admin/:path*", "/api/og-preview", "/api/uploads"]
function requiresAuth(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/api/og-preview") return true;
  if (pathname === "/api/uploads") return true;
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (requiresAuth(context.url.pathname)) {
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
