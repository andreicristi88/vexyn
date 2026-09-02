/**
 * Generates the Content-Security-Policy into dist/_headers, after astro build.
 *
 * WHY A SCRIPT: the site is served as static assets, so there is no per-request
 * hook to mint a CSP nonce — pages never touch the Worker (that is what keeps
 * pageviews free). The alternative to nonces is hashing every inline script,
 * and hashes have to be recomputed whenever an inline script changes. Doing it
 * by hand guarantees that someone edits the theme bootstrap one day and
 * silently breaks every page. So the hashes are derived from the built HTML.
 *
 * WHAT IT PROTECTS: the real threat here is not XSS — there is no user content
 * rendered as HTML — it is a third-party script sharing the page with a parsed
 * bank statement. `connect-src 'self'` is the load-bearing directive: even a
 * compromised script cannot POST the DOM anywhere off-origin.
 *
 * NOT HASHED: <script type="application/ld+json">. Verified in Chrome that a
 * hash-based script-src without 'unsafe-inline' leaves structured data intact
 * (it is data, not executed), so the 57 per-page JSON-LD blocks stay out of the
 * header. Re-check if a browser ever starts enforcing it — the symptom would be
 * structured data disappearing from Rich Results Test.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const DIST = 'dist';
const TEMPLATE = 'public/_headers';
const OUT = join(DIST, '_headers');
const PLACEHOLDER = '#CSP#';

/**
 * Origins the ad network needs, once display ads go live. EMPTY = one strict
 * policy for the whole site, which is the current state.
 *
 * When you fill this in, the generator stops emitting a single `/*` rule and
 * writes an explicit rule per page instead, so that ad pages get ONLY the
 * loose policy. That is deliberate: Cloudflare would otherwise send two CSP
 * headers for an ad page, and browsers enforce the INTERSECTION of multiple
 * policies — the strict one would silently keep blocking the ads.
 *
 * Keep ads off the tool pages. A tool page holds a parsed bank statement in
 * its DOM; an ad page holds an article. Only one of those is safe to share
 * with third-party JavaScript.
 */
const AD_ORIGINS = [];
/** Path prefixes allowed to load ads. Only consulted when AD_ORIGINS is set. */
const AD_PATHS = ['/blog'];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** sha256 of every inline script that the browser will actually execute. */
function inlineScriptHashes(files) {
  const hashes = new Set();
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) {
      const [, attrs, body] = m;
      if (/\ssrc=/.test(attrs)) continue; // external, covered by 'self'
      if (/type=["']application\/ld\+json["']/.test(attrs)) continue; // data, not code
      hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

function policy(hashes, { ads } = { ads: false }) {
  const adSrc = ads && AD_ORIGINS.length ? ' ' + AD_ORIGINS.join(' ') : '';
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}${adSrc}`,
    // Inline style ATTRIBUTES are used for the chart and progress bars, whose
    // widths are computed at runtime. Style injection cannot exfiltrate data
    // the way script injection can, so this is the pragmatic trade.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data:${ads && AD_ORIGINS.length ? ' https:' : ''}`,
    "font-src 'self' https://cdn.jsdelivr.net",
    `connect-src 'self'${adSrc}`,
    // write-excel-file's zip layer can hand large files to an inline blob
    // worker. The CSV→XLSX path does not take it at test sizes, but a size
    // threshold is not something we can exhaustively test, and the failure
    // would be a silently broken download. Allowing it costs nothing that
    // matters: a blob worker inherits this document's policy, so connect-src
    // 'self' still applies inside it — there is no new way out.
    "worker-src 'self' blob:",
    `frame-src ${ads && AD_ORIGINS.length ? AD_ORIGINS.join(' ') : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** dist path → the URL Cloudflare serves it at (build.format: 'file'). */
function urlOf(file) {
  const rel = file.replace(/\\/g, '/').replace(/^dist/, '');
  if (rel === '/index.html') return '/';
  return rel.replace(/\.html$/, '');
}

const files = walk(DIST);
const hashes = inlineScriptHashes(files);
const strict = policy(hashes);

const template = readFileSync(TEMPLATE, 'utf8');
if (!template.includes(PLACEHOLDER)) {
  console.error(`[csp] ${PLACEHOLDER} not found in ${TEMPLATE} — CSP not written.`);
  process.exit(1);
}
const placeholderLine = new RegExp(`^.*${PLACEHOLDER}.*$`, 'm');

let headers;
if (AD_ORIGINS.length === 0) {
  // One policy for the whole site: drop it straight into the existing `/*`
  // block, so there is exactly one rule per path.
  headers = template.replace(placeholderLine, `  Content-Security-Policy: ${strict}`);
} else {
  // Ads are live: the strict policy must NOT match an ad page, so `/*` is
  // replaced by an explicit rule per page. Two matching rules would send two
  // CSP headers and browsers enforce the intersection — the ads would stay
  // blocked while everything looked configured.
  const loose = policy(hashes, { ads: true });
  const isAdPage = (u) => AD_PATHS.some((p) => u === p || u.startsWith(p + '/'));
  const strictPages = files.map(urlOf).filter((u) => !isAdPage(u)).sort();
  const rules = [
    ...strictPages.map((u) => `${u}\n  Content-Security-Policy: ${strict}`),
    ...AD_PATHS.flatMap((p) => [
      `${p}\n  Content-Security-Policy: ${loose}`,
      `${p}/*\n  Content-Security-Policy: ${loose}`,
    ]),
  ].join('\n\n');
  headers = template.replace(placeholderLine, '').trimEnd() + '\n\n' + rules + '\n';
}

writeFileSync(OUT, headers, 'utf8');

console.log(`[csp] ${hashes.length} inline script hashes from ${files.length} pages`);
console.log(`[csp] ${AD_ORIGINS.length ? `per-page rules (ads on ${AD_PATHS.join(', ')})` : 'one strict policy for /*'} → ${OUT}`);
