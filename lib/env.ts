import { z } from "zod";

const ServerEnvSchema = z.object({
  MICROCMS_SERVICE_DOMAIN: z.string().min(1),
  MICROCMS_API_KEY: z.string().min(1),
  MICROCMS_MANAGEMENT_API_KEY: z.string().min(1).optional(),
  MICROCMS_WEBHOOK_SECRET: z.string().min(1),
  CF_ACCESS_TEAM_DOMAIN: z.string().min(1).optional(),
  CF_ACCESS_AUD: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  BYPASS_AUTH: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .default("false"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

const isServer = typeof window === "undefined";

const parseServerEnv = () => {
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "❌ Invalid environment variables:",
      z.treeifyError(parsed.error)
    );
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
};

const parseClientEnv = () => {
  const parsed = ClientEnvSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    throw new Error("Invalid public environment variables");
  }
  return parsed.data;
};

export const env = (isServer ? parseServerEnv() : parseClientEnv()) as ReturnType<
  typeof parseServerEnv
>;

export const isAuthBypassed = () =>
  isServer &&
  env.NODE_ENV === "development" &&
  env.BYPASS_AUTH === "true";
