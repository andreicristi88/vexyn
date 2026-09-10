/**
 * Real per-page modification dates for the sitemap → src/data/lastmod.json
 *
 * The sitemap used to stamp every URL with the build time, so on every deploy
 * all 60 pages "changed" at once. Google treats lastmod as a signal only while
 * it stays consistently accurate, and a value that moves on every deploy is
 * the opposite of that — it stops carrying information, and with it goes the
 * one hint that would tell a crawler with a small budget which page is
 * actually new. The flagship tool sat undiscovered for days looking identical
 * to 59 unchanged neighbours.
 *
 * Guides take their date from frontmatter (updatedDate, else pubDate). Tool
 * and static pages take the last commit that touched the page or the Svelte
 * component it renders. The result is committed, not computed at build time:
 * the hosting build runs on a shallow clone, where every file appears to have
 * been changed by HEAD and the dates would collapse back to one value.
 *
 * Run `npm run lastmod` after adding or materially changing a page, and commit
 * the JSON. A page missing from the file falls back to the build time in
 * astro.config.mjs, which is the right answer for a page that is genuinely new.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const OUT = join(root, 'src', 'data', 'lastmod.json');

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

if (git('rev-parse', '--is-shallow-repository') === 'true') {
  console.error('[lastmod] shallow clone — every file would date to HEAD. Run this on a full checkout and commit the result.');
  process.exit(1);
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const out = {};

// --- guides: frontmatter ----------------------------------------------------
const blogDir = join(root, 'src', 'content', 'blog');
for (const f of readdirSync(blogDir).filter((f) => f.endsWith('.md'))) {
  // Some posts were saved with CRLF; without this the opening fence never matches.
  const src = readFileSync(join(blogDir, f), 'utf8').replace(/\r\n/g, '\n');
  const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const updated = fm.match(/^updatedDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
  const pub = fm.match(/^pubDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
  const d = updated ?? pub;
  if (d) out[`/blog/${f.replace(/\.md$/, '')}`] = `${d}T12:00:00.000Z`;
}

// --- pages: last commit touching the page, or the tool component it imports --
const pagesDir = join(root, 'src', 'pages');
for (const f of readdirSync(pagesDir).filter((f) => f.endsWith('.astro') && f !== '404.astro')) {
  const slug = f.replace(/\.astro$/, '');
  const path = slug === 'index' ? '/' : `/${slug}`;
  const src = readFileSync(join(pagesDir, f), 'utf8');
  const files = [`src/pages/${f}`];
  for (const m of src.matchAll(/from\s+'\.\.\/components\/tools\/([^']+)'/g)) files.push(`src/components/tools/${m[1]}`);
  // The homepage and the guides index are grids over the registry.
  if (slug === 'index') files.push('src/lib/tools.ts');
  const iso = git('log', '-1', '--format=%cI', '--', ...files);
  if (iso) out[path] = new Date(iso).toISOString();
}
const blogIndex = join(pagesDir, 'blog', 'index.astro');
if (existsSync(blogIndex)) {
  const iso = git('log', '-1', '--format=%cI', '--', 'src/pages/blog/index.astro', 'src/content/blog');
  if (iso) out['/blog'] = new Date(iso).toISOString();
}

mkdirSync(join(root, 'src', 'data'), { recursive: true });
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');

const changed = Object.entries(sorted).filter(([k, v]) => previous[k] !== v);
console.log(`[lastmod] ${Object.keys(sorted).length} pages dated, ${changed.length} changed since last run`);
for (const [k, v] of changed.slice(0, 20)) console.log(`   ${v.slice(0, 10)}  ${k}${previous[k] ? '' : '  (new)'}`);
