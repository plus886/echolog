// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  // Astro 6 では adapter 指定時に output: 'server' が default だが、明示する。
  output: "server",
  adapter: cloudflare({
    // 本案件は <img src="microcms-asset/..."> 直 (raw <img>) で運用しており、
    // Astro の Image Service / Cloudflare Images binding を必要としない。
    // 未指定だと adapter が IMAGES binding を要求する build を出すので
    // "passthrough" で off。
    imageService: "passthrough",
  }),
  integrations: [react()],

  // Astro Actions の本文サイズ上限 (既定 1MB)。admin の写真投稿は
  // クライアントで 2048px / JPEG q85 に縮小して送るが、内容の細かい写真は
  // それでも 1MB を超えることがある。actions はすべて Cloudflare Access
  // 配下 (オーナー専用) なので、PHOTO_MAX_BYTES (25MB) を上回る 30MB に
  // 引き上げ、サイズ超過は actions 側の判定で「上限25MB」を出すようにする。
  security: {
    actionBodySizeLimit: 30 * 1024 * 1024,
  },

  // Astro Sessions は echolog では未使用 (認証は Cloudflare Access の JWT)。
  // @astrojs/cloudflare adapter は config.session?.driver が未設定だと
  // 自動で cloudflare-kv-binding ドライバ + SESSION KV binding を要求する
  // (build 出力 dist/server/wrangler.json に kv_namespaces が injection
  // される)。不要な KV namespace を本番に作る/維持するのを避けるため、
  // in-isolate-memory driver を明示指定して KV 要求をスキップさせる。
  // Sessions API 自体は動作するが、isolate を跨いで保持されないので
  // 実質的に使えない (こちらの想定どおり)。
  session: {
    driver: "memory",
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
