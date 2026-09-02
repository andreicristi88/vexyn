/**
 * Vexyn Cloudflare Worker — first-party, cookieless analytics only.
 *
 * The site itself is static (Workers Static Assets serve /dist directly, for
 * free). This Worker runs ONLY for /api/* (see wrangler.toml run_worker_first),
 * so pageviews cost nothing and only the two API calls invoke it:
 *
 *   POST /api/hit             — record one pageview into Analytics Engine
 *   GET  /api/stats?key=...   — key-protected mini dashboard (reads AE via SQL)
 *
 * Modelled on folositor.ro's analytics. No cookies, no stored PII: the "unique
 * visitor" is a daily rotating hash of IP+UA (like Plausible), never persisted.
 *
 * Secrets (wrangler secret put):
 *   STATS_API_TOKEN — Cloudflare API token with Account Analytics:Read
 *   STATS_KEY       — password for /api/stats
 * Var: CF_ACCOUNT_ID (in wrangler.toml).
 */

interface AnalyticsEngineDataset {
  writeDataPoint(event: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void;
}

interface Env {
  ASSETS: Fetcher;
  ANALYTICS?: AnalyticsEngineDataset;
  CF_ACCOUNT_ID?: string;
  STATS_API_TOKEN?: string;
  STATS_KEY?: string;
}

const DATASET = 'vexyn_web';

type CfInfo = {
  country?: string;
  city?: string;
  asOrganization?: string;
  botManagement?: { verifiedBot?: boolean; score?: number };
};

const BOT_RE =
  /bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebook|embed|preview|scan|curl|wget|python|okhttp|http-client|headless|phantom|puppeteer|playwright|lighthouse|monitor|uptime|pingdom|gtmetrix|dataprovider|semrush|ahrefs|petalbot|bytespider|chatgpt|gptbot|anthropic|claude|ccbot|perplexity|applebot|amazonbot|meta-external|facebookexternalhit|bytedance|dataforseo|diffbot|imagesift|omgili|dotbot|mj12|seznam|screaming|node-fetch|node\.js|axios|go-http|java\/|ruby|scrapy|aiohttp|libwww|httpx|apache-httpclient|guzzle|postman|insomnia|zgrab|masscan|censys|shodan|\bfetch\b|undici/i;

const DC_RE =
  /amazon|aws|google|azure|microsoft|digitalocean|digital ?ocean|linode|akamai|\bovh\b|hetzner|vultr|oracle|alibaba|tencent|leaseweb|contabo|scaleway|choopa|\bm247\b|datacamp|colocation|data ?cent(er|re)|fastly|gcore|g-core|hostinger|namecheap|godaddy|ionos|colocrossing|quadranet|psychz|nforce|worldstream|fdcservers|reliablesite|sharktech|hostwinds|webnx|\bvps\b/i;

async function sha16(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function deviceOf(ua: string): string {
  const u = ua.toLowerCase();
  if (u.includes('ipad')) return 'iPad';
  if (u.includes('iphone') || u.includes('ipod')) return 'iPhone';
  if (u.includes('android')) return u.includes('mobile') ? 'Android (mobile)' : 'Android (tablet)';
  if (u.includes('windows')) return 'Windows';
  if (u.includes('macintosh') || u.includes('mac os')) return 'Mac';
  if (u.includes('cros')) return 'ChromeOS';
  if (u.includes('linux')) return 'Linux';
  return 'Other';
}

function limbaOf(al: string): string {
  if (!al) return '-';
  const primary = al.toLowerCase().split(',')[0].split(';')[0].trim().split('-')[0];
  return /^[a-z]{2,3}$/.test(primary) ? primary : '?';
}

// "human" vs "bot" plus the reason. Note: unlike folositor, we do NOT treat
// Linux desktop as a bot — Vexyn's audience is global developers and founders,
// many genuinely on Linux; that heuristic would undercount real users.
function classify(ua: string, cf: CfInfo): { cls: 'human' | 'bot'; reason: string } {
  const bm = cf.botManagement;
  const scored = typeof bm?.score === 'number' ? 's' : '-';
  const M = (cls: 'human' | 'bot', r: string) => ({ cls, reason: `${r}|${scored}` });
  if (bm?.verifiedBot) return M('bot', 'verified');
  if (typeof bm?.score === 'number' && bm.score > 0 && bm.score < 30) return M('bot', 'score');
  if (BOT_RE.test(ua)) return M('bot', 'ua');
  if (DC_RE.test(String(cf.asOrganization || ''))) return M('bot', 'datacenter');
  return M('human', 'human');
}

function sourceOf(ref: string): string {
  if (!ref) return 'Direct / unknown';
  let host = ref;
  try { host = new URL(ref).hostname; } catch { /* ignore */ }
  host = host.replace(/^www\./, '').toLowerCase();
  if (host.includes('vexyn.app')) return 'Internal (vexyn.app)';
  if (host.includes('chatgpt') || host.includes('openai')) return 'ChatGPT';
  if (host.includes('claude.ai') || host.includes('anthropic')) return 'Claude';
  if (host.includes('perplexity')) return 'Perplexity';
  if (host.includes('copilot')) return 'Copilot';
  if (host.includes('gemini.google') || host.includes('bard.google')) return 'Gemini';
  if (host.includes('grok') || host === 'x.ai') return 'Grok';
  if (host.includes('google')) return 'Google';
  if (host.includes('bing')) return 'Bing';
  if (host.includes('duckduckgo')) return 'DuckDuckGo';
  if (host.includes('yahoo')) return 'Yahoo';
  if (host.includes('ecosia')) return 'Ecosia';
  if (host.includes('brave')) return 'Brave';
  if (host.includes('yandex')) return 'Yandex';
  if (host.includes('facebook') || host.includes('.fb.')) return 'Facebook';
  if (host.includes('instagram')) return 'Instagram';
  if (host === 't.co' || host.includes('twitter') || host === 'x.com') return 'X / Twitter';
  if (host.includes('reddit')) return 'Reddit';
  if (host.includes('linkedin')) return 'LinkedIn';
  if (host.includes('news.ycombinator') || host.includes('hacker')) return 'Hacker News';
  if (host.includes('t.me') || host.includes('telegram')) return 'Telegram';
  if (host.includes('github')) return 'GitHub';
  return host || 'Direct / unknown';
}

// POST /api/hit — one pageview. Always answers 204, never blocks the page.
async function trackHit(request: Request, env: Env): Promise<Response> {
  const noContent = new Response(null, { status: 204 });
  try {
    if (!env.ANALYTICS) return noContent;
    const ua = request.headers.get('user-agent') || '';
    if (!ua) return noContent;
    let body: { p?: string; r?: string; w?: number } = {};
    try { body = JSON.parse((await request.text()) || '{}'); } catch { /* ignore */ }
    const cf = ((request as unknown as { cf?: CfInfo }).cf || {}) as CfInfo;
    const path = (body.p || '/').slice(0, 200);
    const ref = (body.r || '').slice(0, 200);
    const country = cf.country || 'XX';
    const city = cf.city || '';
    const ip = request.headers.get('cf-connecting-ip') || '';
    const day = new Date().toISOString().slice(0, 10);
    const visitor = await sha16(`${ip}|${ua}|${day}|vexyn-salt-2026`);
    const device = deviceOf(ua);
    const c = body.w ? { cls: 'bot' as const, reason: 'webdriver|-' } : classify(ua, cf);
    const org = String(cf.asOrganization || '').slice(0, 60);
    const lang = limbaOf(request.headers.get('accept-language') || '');
    env.ANALYTICS.writeDataPoint({
      indexes: [path.slice(0, 96)],
      blobs: [path, ref, country, city, visitor, device, c.cls, org, c.reason, lang],
      doubles: [1],
    });
  } catch { /* never block */ }
  return noContent;
}

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]!));

// GET /api/stats?key=SECRET&days=14 — mini dashboard.
async function statsPage(url: URL, env: Env): Promise<Response> {
  if (!env.STATS_KEY || url.searchParams.get('key') !== env.STATS_KEY)
    return new Response('Unauthorized', { status: 401 });
  if (!env.CF_ACCOUNT_ID || !env.STATS_API_TOKEN)
    return new Response('Missing CF_ACCOUNT_ID / STATS_API_TOKEN', { status: 500 });
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '14', 10)));
  const key = env.STATS_KEY;

  async function q(sql: string): Promise<Record<string, string>[]> {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
      { method: 'POST', headers: { Authorization: `Bearer ${env.STATS_API_TOKEN}` }, body: sql },
    );
    const j = (await r.json()) as { data?: Record<string, string>[] };
    return j.data || [];
  }

  // Optional single-day drill-down: ?zi=YYYY-MM-DD restricts the page/source/
  // country/device panels to that day. The daily table stays on the full window
  // so you can click between days.
  const zi = (url.searchParams.get('zi') || '').match(/^\d{4}-\d{2}-\d{2}$/)?.[0] || '';
  const since = `timestamp >= toStartOfDay(now()) - INTERVAL '${days - 1}' DAY`;
  const windowClause = zi
    ? `timestamp >= toDateTime('${zi} 00:00:00') AND timestamp < toDateTime('${zi} 00:00:00') + INTERVAL '1' DAY`
    : since;
  const human = `${windowClause} AND blob7 != 'bot'`;

  const [daily, pages, refs, countries, devices, totals] = await Promise.all([
    q(`SELECT toStartOfDay(timestamp) AS day, blob7 AS cls, count(DISTINCT blob5) AS visitors, sum(_sample_interval) AS pv FROM ${DATASET} WHERE ${since} GROUP BY day, cls ORDER BY day DESC`),
    q(`SELECT blob1 AS path, sum(_sample_interval) AS pv, count(DISTINCT blob5) AS visitors FROM ${DATASET} WHERE ${human} GROUP BY path ORDER BY pv DESC LIMIT 40`),
    q(`SELECT blob2 AS ref, sum(_sample_interval) AS pv FROM ${DATASET} WHERE ${human} GROUP BY ref`),
    q(`SELECT blob3 AS country, sum(_sample_interval) AS pv FROM ${DATASET} WHERE ${human} GROUP BY country ORDER BY pv DESC LIMIT 25`),
    q(`SELECT blob6 AS device, sum(_sample_interval) AS pv FROM ${DATASET} WHERE ${human} GROUP BY device ORDER BY pv DESC LIMIT 15`),
    q(`SELECT count(DISTINCT blob5) AS visitors, sum(_sample_interval) AS pv FROM ${DATASET} WHERE ${human}`),
  ]);

  const byDay: Record<string, { hum: number; bot: number; pv: number }> = {};
  for (const r of daily) {
    const d = String(r.day).slice(0, 10);
    (byDay[d] ||= { hum: 0, bot: 0, pv: 0 });
    const v = Number(r.visitors || 0);
    // Bots contribute to the bot visitor count only; "Views" counts human
    // pageviews so it matches the human-only KPIs above.
    if (r.cls === 'bot') byDay[d].bot += v;
    else { byDay[d].hum += v; byDay[d].pv += Number(r.pv || 0); }
  }
  // Referrers → readable sources.
  const bySource: Record<string, number> = {};
  for (const r of refs) {
    const s = sourceOf(r.ref || '');
    bySource[s] = (bySource[s] || 0) + Number(r.pv || 0);
  }
  const sources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 20);

  const totVisitors = Number(totals[0]?.visitors || 0);
  const totPv = Number(totals[0]?.pv || 0);

  const list = (title: string, rows: [string, number][], max?: number) => {
    const top = rows[0]?.[1] || 1;
    return `<div class="card"><h2>${esc(title)}</h2><table>${rows
      .slice(0, max || 40)
      .map(([label, n]) => `<tr><td class="l"><span class="bar" style="width:${Math.max(2, (n / top) * 100)}%"></span><span class="lbl">${esc(label)}</span></td><td class="n">${n.toLocaleString()}</td></tr>`)
      .join('')}</table></div>`;
  };

  const dayLink = (d: string) => `?key=${encodeURIComponent(key)}&days=${days}${d === zi ? '' : `&zi=${d}`}`;
  const dayRows = Object.entries(byDay)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([d, v]) => `<tr class="${d === zi ? 'sel' : ''}"><td><a href="${dayLink(d)}">${d}</a></td><td class="n hum">${v.hum.toLocaleString()}</td><td class="n bot">${v.bot.toLocaleString()}</td><td class="n">${v.pv.toLocaleString()}</td></tr>`)
    .join('');

  const daysNav = [7, 14, 30, 90]
    .map((d) => `<a href="?key=${encodeURIComponent(key)}&days=${d}" class="${d === days ? 'on' : ''}">${d}d</a>`)
    .join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Vexyn analytics</title><style>
  :root{--bg:#0c1116;--surface:#151c24;--border:#263441;--text:#e7edf3;--mute:#8aa0b2;--brand:#34d399;--danger:#f87171}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;max-width:1100px;margin:0 auto}
  h1{font-size:20px;margin:0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--mute);margin:0 0 10px}
  .top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap}
  .nav a{color:var(--mute);text-decoration:none;padding:4px 10px;border:1px solid var(--border);border-radius:8px;margin-left:6px}
  .nav a.on{color:#04110b;background:var(--brand);border-color:var(--brand);font-weight:600}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
  .kpi{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px}
  .kpi .v{font-size:24px;font-weight:700}.kpi .k{font-size:12px;color:var(--mute)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;overflow:hidden}
  .card.wide{grid-column:1/-1}
  table{width:100%;border-collapse:collapse}
  td{padding:4px 2px;vertical-align:middle}
  td.l{position:relative;max-width:0;width:100%}
  .lbl{position:relative;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:100%}
  .bar{position:absolute;left:0;top:0;bottom:0;background:color-mix(in srgb,var(--brand) 16%,transparent);border-radius:4px}
  td.n{text-align:right;font-variant-numeric:tabular-nums;color:var(--mute);padding-left:12px;white-space:nowrap}
  td.n.hum{color:var(--brand)}td.n.bot{color:var(--danger)}
  .daily td{border-bottom:1px solid var(--border)}
  .daily a{color:var(--text);text-decoration:none}.daily a:hover{color:var(--brand)}
  .daily tr.sel td{background:color-mix(in srgb,var(--brand) 12%,transparent)}
  @media(max-width:640px){.grid{grid-template-columns:1fr}}
  </style></head><body>
  <div class="top"><h1>Vexyn analytics <span style="color:var(--mute);font-weight:400">· ${zi ? esc(zi) : days + ' days'}</span></h1><div class="nav">${zi ? `<a href="?key=${encodeURIComponent(key)}&days=${days}">← all days</a>` : ''}${daysNav}</div></div>
  ${zi ? `<p style="color:var(--mute);margin:-6px 0 14px">Pages, sources, countries and devices below show <b style="color:var(--text)">${esc(zi)}</b> only. Click another day in the table to switch, or “← all days”.</p>` : ''}
  <div class="kpis">
    <div class="kpi"><div class="v">${totVisitors.toLocaleString()}</div><div class="k">Visitors (humans)</div></div>
    <div class="kpi"><div class="v">${totPv.toLocaleString()}</div><div class="k">Pageviews</div></div>
    <div class="kpi"><div class="v">${totVisitors ? (totPv / totVisitors).toFixed(2) : '0'}</div><div class="k">Pages / visitor</div></div>
  </div>
  <div class="grid">
    <div class="card wide daily"><h2>By day — humans / bots / pageviews</h2><table><tr><td>Day</td><td class="n">Humans</td><td class="n">Bots</td><td class="n">Views</td></tr>${dayRows || '<tr><td colspan=4>No data yet.</td></tr>'}</table></div>
    ${list('Top pages', pages.map((r) => [r.path || '/', Number(r.pv || 0)] as [string, number]))}
    ${list('Sources', sources)}
    ${list('Countries', countries.map((r) => [r.country || 'XX', Number(r.pv || 0)] as [string, number]))}
    ${list('Devices', devices.map((r) => [r.device || 'Other', Number(r.pv || 0)] as [string, number]))}
  </div>
  </body></html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/api/hit' && request.method === 'POST') return trackHit(request, env);
    if (path === '/api/stats' && request.method === 'GET') return statsPage(url, env);
    // Any other /api/* → 404 (assets are served directly, not from here).
    if (path.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
