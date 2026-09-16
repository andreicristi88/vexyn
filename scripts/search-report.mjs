/**
 * Weekly search read: the GSC and Bing exports from Downloads, as one table,
 * with the change since the previous run.
 *
 *   node scripts/search-report.mjs
 *
 * Picks the newest "https___vexyn.app_-Performance-on-Search-*.xlsx" (Google
 * Search Console → Performance → Export) and the newest
 * "vexyn.app_SearchPerformanceOverview_*.csv" (Bing Webmaster Tools) in
 * ~/Downloads. Nothing is fetched; nothing leaves the machine.
 *
 * Each run is snapshotted to .search-history/<date>.json (gitignored — it is
 * the site's own search data, not code) so the next run can say what moved.
 *
 * Why a script: seven sheets of impressions at position 70 are easy to read
 * wrong. The questions that matter are few — is the impressions curve rising,
 * which pages and queries carry it, has a page or query appeared or vanished,
 * is position moving — and they are the same every week.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readXlsxFile from 'read-excel-file/node';

const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const HISTORY = path.join(process.cwd(), '.search-history');

const newest = (re) =>
  fs.readdirSync(DOWNLOADS)
    .filter((f) => re.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(DOWNLOADS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0]?.f;

// An explicit file name (in Downloads) as the first argument seeds the history
// with an older export; otherwise the newest one is read.
const gscFile = process.argv[2] ?? newest(/^https___vexyn\.app_-Performance-on-Search-.*\.xlsx$/);
const bingFile = newest(/^vexyn\.app_SearchPerformanceOverview_.*\.csv$/);
if (!gscFile) { console.error('No GSC export in Downloads.'); process.exit(1); }

// --- Google -------------------------------------------------------------------
// read-excel-file 9 returns every sheet as { sheet, data } in one call.
const workbook = await readXlsxFile(path.join(DOWNLOADS, gscFile));
const sheet = async (name) => {
  const s = workbook.find((x) => x.sheet === name);
  if (!s) return [];
  return s.data.slice(1).map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c)));
};
const num = (v) => (v === '' || v == null ? 0 : Number(v));
const daily = (await sheet('Diagramă')).map(([d, c, i, , p]) => ({ date: String(d).slice(0, 10), clicks: num(c), imps: num(i), pos: num(p) }));
const queries = (await sheet('Interogări')).map(([q, c, i, , p]) => ({ key: String(q), clicks: num(c), imps: num(i), pos: num(p) }));
const pages = (await sheet('Pagini')).map(([u, c, i, , p]) => ({ key: String(u).replace('https://vexyn.app', '') || '/', clicks: num(c), imps: num(i), pos: num(p) }));
const filters = Object.fromEntries((await sheet('Filtre')).map(([k, v]) => [String(k), String(v)]));

// --- Bing ---------------------------------------------------------------------
let bing = [];
if (bingFile) {
  const lines = fs.readFileSync(path.join(DOWNLOADS, bingFile), 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
  bing = lines.map((l) => {
    const [d, c, i] = l.split('","').map((x) => x.replace(/^"|"$/g, ''));
    // "9/5/2026 12:00:00 AM" — read the M/D/YYYY by hand; Date() would take it
    // as local midnight and toISOString would push it to the previous UTC day.
    const [m, day, y] = d.split(' ')[0].split('/');
    return { date: `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`, clicks: num(c), imps: num(i) };
  });
}

// --- previous snapshot ----------------------------------------------------------
fs.mkdirSync(HISTORY, { recursive: true });
const prevFile = fs.readdirSync(HISTORY).filter((f) => f.endsWith('.json')).sort().at(-1);
let prev = prevFile ? JSON.parse(fs.readFileSync(path.join(HISTORY, prevFile), 'utf8')) : null;
// Snapshots are keyed by the export's date, not the run's, so re-running on
// the same file overwrites its own snapshot instead of comparing it to itself.
const today = gscFile.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
const prevIsSame = prev && prev.date === today;
const snapshot = { date: today, gscFile, bingFile, window: filters['Data'] ?? '', daily, queries, pages, bing };
fs.writeFileSync(path.join(HISTORY, `${today}.json`), JSON.stringify(snapshot, null, 2));

if (prevIsSame) prev = null; // same export as last time: nothing to compare against
// --- report ---------------------------------------------------------------------
const sum = (a, k) => a.reduce((t, r) => t + r[k], 0);
const pad = (s, n) => String(s).padEnd(n);
const line = (s) => console.log(s);

line(`\nGoogle — ${gscFile}  (${filters['Data'] ?? '?'})`);
line(`  ${pad('day', 12)} ${pad('imps', 6)} ${pad('clicks', 7)} pos`);
for (const d of daily) line(`  ${pad(d.date, 12)} ${pad(d.imps, 6)} ${pad(d.clicks, 7)} ${d.pos ? d.pos.toFixed(0) : '—'}`);
const gImps = sum(daily, 'imps'), gClicks = sum(daily, 'clicks');
const prevImps = prev ? sum(prev.daily, 'imps') : null;
line(`  total: ${gImps} impressions, ${gClicks} clicks` + (prev ? `  (previous run ${prev.date}: ${prevImps} impressions → ${gImps >= prevImps ? '+' : ''}${gImps - prevImps})` : ''));

const table = (title, rows, prevRows) => {
  line(`\n${title}`);
  const prevMap = new Map((prevRows ?? []).map((r) => [r.key, r]));
  for (const r of rows.slice(0, 20)) {
    const p = prevMap.get(r.key);
    const tag = !prevRows ? '' : !p ? '  NEW' : r.pos && p.pos ? `  pos ${p.pos.toFixed(0)}→${r.pos.toFixed(0)}` : '';
    line(`  ${pad(r.imps, 5)} ${pad(r.clicks, 3)} ${pad(r.pos ? r.pos.toFixed(0) : '—', 4)} ${r.key}${tag}`);
  }
  if (prevRows) {
    const gone = prevRows.filter((p) => !rows.some((r) => r.key === p.key));
    if (gone.length) line(`  gone since ${prev.date}: ${gone.map((g) => g.key).join(', ')}`);
  }
};
table('Pages  (imps clicks pos)', pages, prev?.pages);
table('Queries  (imps clicks pos)', queries, prev?.queries);

if (bing.length) {
  line(`\nBing — ${bingFile}`);
  for (const d of bing) line(`  ${pad(d.date, 12)} ${pad(d.imps, 6)} ${d.clicks}`);
  line(`  total: ${sum(bing, 'imps')} impressions, ${sum(bing, 'clicks')} clicks`);
}
line(`\nsnapshot → .search-history/${today}.json${prev ? `  (compared with ${prev.date})` : '  (first run, nothing to compare)'}\n`);
