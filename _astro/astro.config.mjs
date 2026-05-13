// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Astro 6 では adapter 指定時に output: 'server' が default だが、明示する。
  output: 'server',
  adapter: cloudflare({
    // 本案件は <img src="microcms-asset/..."> 直 (raw <img>) で運用しており、
    // Astro の Image Service / Cloudflare Images binding を必要としない。
    // 未指定だと adapter が IMAGES binding を要求する build を出すので
    // "passthrough" で off。
    imageService: 'passthrough',
  }),
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});
