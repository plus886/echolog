// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Astro 6 では adapter 指定時に output: 'server' が default だが、明示する。
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()]
  }
});