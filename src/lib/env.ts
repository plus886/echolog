import { env as rawEnv } from "cloudflare:workers";
import { z } from "zod";

// Astro v6 (+ @astrojs/cloudflare v13+) の env アクセス API。
// v5 までの `Astro.locals.runtime.env` は v6 で廃止され、
// `import { env } from "cloudflare:workers"` が新しい正規ルート。
// この import は per-Worker-isolate で env を返し、リクエスト間の干渉
// は無いため、module-level に validated cache を保持して安全。

const ServerEnvSchema = z.object({
  MICROCMS_SERVICE_DOMAIN: z.string().min(1),
  MICROCMS_API_KEY: z.string().min(1),
  MICROCMS_MANAGEMENT_API_KEY: z.string().min(1).optional(),
  MICROCMS_WEBHOOK_SECRET: z.string().min(1),
  FORMOSA_MICROCMS_SERVICE_DOMAIN: z.string().min(1),
  FORMOSA_MICROCMS_API_KEY: z.string().min(1),
  FORMOSA_MICROCMS_WEBHOOK_SECRET: z.string().min(1),
  // Claude API — 日本語投稿を台湾繁體中文へ自動翻訳する (lib/translate.ts)。
  // 未設定でもサイトは動く。その場合は投稿時の翻訳のみ失敗する。
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CF_ACCESS_TEAM_DOMAIN: z.string().min(1).optional(),
  CF_ACCESS_AUD: z.string().min(1).optional(),
  // Astro 流の公開変数 prefix。旧 NEXT_PUBLIC_SITE_URL から改名。
  PUBLIC_SITE_URL: z.string().url(),
  BYPASS_AUTH: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .default("false"),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

// 初回呼び出し時に schema 検証して module レベル cache に詰める。
// Worker isolate ごとに別 cache (= 別 env) なので request 間の干渉なし。
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error(
      "[env] invalid environment variables",
      z.treeifyError(parsed.error),
    );
    throw new Error("Invalid environment variables");
  }
  cached = parsed.data;
  return parsed.data;
}

// dev 限定の認証スキップ。BYPASS_AUTH=true + DEV のとき有効。
// import.meta.env.DEV は Astro/Vite が build 時に静的注入する値。
export function isAuthBypassed(): boolean {
  return import.meta.env.DEV && getEnv().BYPASS_AUTH === "true";
}
