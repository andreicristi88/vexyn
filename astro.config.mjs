// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import lastmod from './src/data/lastmod.json' with { type: 'json' };

/**
 * When a page last actually changed, for the sitemap. Generated from git and
 * frontmatter by `npm run lastmod` and committed — see scripts/generate-lastmod.mjs
 * for why it is not computed here. A page not in the file is new, and gets now.
 */
const buildTime = new Date();
function lastmodFor(url) {
  const path = new URL(url).pathname.replace(/\/$/, '') || '/';
  const iso = /** @type {Record<string, string>} */ (lastmod)[path];
  return iso ? new Date(iso) : buildTime;
}

export default defineConfig({
  site: 'https://vexyn.app',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  markdown: {
    // Dual-theme syntax highlighting. Shiki emits both colour sets inline;
    // CSS in global.css picks the right one based on the .light class.
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      wrap: true,
    },
  },
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      serialize(item) {
        // Every URL used to carry the build time, so all 60 "changed" on every
        // deploy and the field stopped saying anything. Real dates per page now.
        const lastmod = lastmodFor(item.url).toISOString();
        // Homepage gets max priority + daily; tools weekly; static pages monthly
        if (item.url === 'https://vexyn.app/') {
          return { ...item, lastmod, priority: 1.0, changefreq: 'daily' };
        }
        if (item.url.endsWith('/about') || item.url.endsWith('/privacy') || item.url.endsWith('/404')) {
          return { ...item, lastmod, priority: 0.3, changefreq: 'monthly' };
        }
        return { ...item, lastmod, priority: 0.8, changefreq: 'weekly' };
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
