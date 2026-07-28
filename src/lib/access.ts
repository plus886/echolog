import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { getEnv, isAuthBypassed } from "@/lib/env";

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
export const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";
// Access がログイン時にドメイン全体へ発行するクッキー。ヘッダと同じ JWT を
// 運ぶので、Access application のパス外 (/_actions 等) の検証に使える。
export const ACCESS_COOKIE = "CF_Authorization";

const BYPASS_USER_EMAIL = "local-dev@echolog.local";

export type AccessUser = {
  email: string;
  bypassed: boolean;
};

// JWKS は team domain ごとに module-level cache。AsyncLocalStorage で env が
// 切り替わっても、同じ team domain ならフェッチ結果を共有できる。
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks() {
  const env = getEnv();
  if (!env.CF_ACCESS_TEAM_DOMAIN) {
    throw new Error(
      "CF_ACCESS_TEAM_DOMAIN is not set. Required for JWT verification.",
    );
  }
  const cached = jwksCache.get(env.CF_ACCESS_TEAM_DOMAIN);
  if (cached) return cached;
  const url = new URL(
    "/cdn-cgi/access/certs",
    `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
  );
  const jwks = createRemoteJWKSet(url);
  jwksCache.set(env.CF_ACCESS_TEAM_DOMAIN, jwks);
  return jwks;
}

type VerifyOptions = {
  jwt: string | null | undefined;
  email?: string | null;
};

export type VerifyResult =
  | { ok: true; user: AccessUser }
  | { ok: false; reason: string };

export async function verifyAccess({
  jwt,
  email,
}: VerifyOptions): Promise<VerifyResult> {
  if (isAuthBypassed()) {
    return {
      ok: true,
      user: { email: email ?? BYPASS_USER_EMAIL, bypassed: true },
    };
  }

  if (!jwt) {
    return { ok: false, reason: "missing-jwt" };
  }

  const env = getEnv();
  if (!env.CF_ACCESS_AUD) {
    return { ok: false, reason: "missing-aud-config" };
  }

  try {
    const { payload } = await jwtVerify<JWTPayload & { email?: string }>(
      jwt,
      getJwks(),
      {
        audience: env.CF_ACCESS_AUD,
        issuer: `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
      },
    );
    return {
      ok: true,
      user: {
        email: payload.email ?? email ?? "unknown",
        bypassed: false,
      },
    };
  } catch (cause) {
    return {
      ok: false,
      reason: cause instanceof Error ? cause.message : "verify-failed",
    };
  }
}
