import { NextResponse, type NextRequest } from "next/server";

import {
  ACCESS_EMAIL_HEADER,
  ACCESS_JWT_HEADER,
  verifyAccess,
} from "@/lib/access";

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/tweets/:path*", "/api/og-preview"],
};

export async function proxy(request: NextRequest) {
  const jwt = request.headers.get(ACCESS_JWT_HEADER);
  const email = request.headers.get(ACCESS_EMAIL_HEADER);

  const result = await verifyAccess({ jwt, email });
  if (!result.ok) {
    return NextResponse.json(
      { error: "unauthorized", reason: result.reason },
      { status: 401 },
    );
  }

  const headers = new Headers(request.headers);
  headers.set("x-echolog-user-email", result.user.email);
  headers.set(
    "x-echolog-bypassed",
    result.user.bypassed ? "true" : "false",
  );
  return NextResponse.next({
    request: { headers },
  });
}
