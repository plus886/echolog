import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { env, isAuthBypassed } from "@/lib/env";

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
export const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";

const BYPASS_USER_EMAIL = "local-dev@echolog.local";

export type AccessUser = {
  email: string;
  bypassed: boolean;
};

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!env.CF_ACCESS_TEAM_DOMAIN) {
    throw new Error(
      "CF_ACCESS_TEAM_DOMAIN is not set. Required for JWT verification.",
    );
  }
  if (!cachedJwks) {
    const url = new URL(
      "/cdn-cgi/access/certs",
      `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
    );
    cachedJwks = createRemoteJWKSet(url);
  }
  return cachedJwks;
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
