// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://vexyn.app',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        // Homepage gets max priority + daily; tools weekly; static pages monthly
        if (item.url === 'https://vexyn.app/') {
          return { ...item, priority: 1.0, changefreq: 'daily' };
        }
        if (item.url.endsWith('/about') || item.url.endsWith('/privacy') || item.url.endsWith('/404')) {
          return { ...item, priority: 0.3, changefreq: 'monthly' };
        }
        return { ...item, priority: 0.8, changefreq: 'weekly' };
      },
    }),
    svelte(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
});
