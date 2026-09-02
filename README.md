# Vexyn

> Financial data tools that never leave your device.

[![Live site](https://img.shields.io/badge/live-vexyn.app-10b981?style=flat-square)](https://vexyn.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-a855f7?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/andreicristi88/vexyn?style=flat-square&color=10b981)](https://github.com/andreicristi88/vexyn/stargazers)

A collection of free browser tools for working with financial data — cleaning and converting CSVs, reconciling Stripe and bank exports, and analyzing your own statements. Every tool processes your file **in your browser**: it is read and worked on locally and never uploaded. Close the tab and the data is gone.

🌐 **[vexyn.app](https://vexyn.app)**

---

## What this is

Bank exports, Stripe reports, and spreadsheets are exactly the kind of files you should not be pasting into a random website. Vexyn's tools are JavaScript (with WebAssembly where it helps) that runs on your device — there is no upload endpoint, so the file you drop in never makes a network request. You can confirm it in your browser's Network tab.

The site is funded by display advertising, and it runs its own first-party, cookieless analytics for aggregate traffic counts. Neither ever has access to the files you process, because those never leave your browser in the first place. Privacy here is scoped to the thing that matters: **your data**, not a blanket "no cookies" claim the ads would break.

## Tools

Three zones, 25 tools, all client-side. The registry in [`src/lib/tools.ts`](src/lib/tools.ts) is the single source of truth.

### Financial Data — clean, convert and reshape CSVs and bank exports
CSV Cleaner · CSV to Excel · CSV Deduplicator · CSV Merger · CSV to JSON · CSV to QBO · CSV to OFX · Bank CSV Formatter

### Business Finance — Stripe, reconciliation, revenue and SaaS metrics
Stripe CSV Cleaner · Stripe Payout Analyzer · Stripe Reconciliation · Invoice Reconciliation · Bank Reconciliation · Transaction Matcher · Revenue Analyzer · SaaS Metrics

### Personal Finance — understand your bank statements and spending
Bank Statement Analyzer · Subscription Finder · Recurring Payment Finder · Spending Analyzer · Transaction Categorizer · Duplicate Transaction Finder · Merchant Analyzer · Cash Flow Analyzer · Net Worth Analyzer

Most tools are faces of a small number of shared engines (statement parsing, transaction matching, multi-format export) — the names are separate because people search for the specific job. Every tool has a matching guide under [`/blog`](https://vexyn.app/blog).

## Why it stays free

By pushing the work to the user's device there are no per-request costs, so the tools can be given away and funded by ads instead of a paywall. Hosting is Cloudflare Workers Static Assets (pageviews are served as static files and cost nothing); a small Worker runs only for the two `/api/*` analytics endpoints.

## Tech stack

- **[Astro 6](https://astro.build)** — static output, islands architecture (`trailingSlash: 'never'`, `build.format: 'file'`)
- **[Svelte 5](https://svelte.dev)** — interactive tool islands, runes API
- **[Tailwind CSS 4](https://tailwindcss.com)** — styling via the Vite plugin
- **[TypeScript](https://www.typescriptlang.org)** — strict mode

### Per-tool libraries

| Library | Used by |
|---------|---------|
| [`papaparse`](https://www.papaparse.com/) | CSV parsing across every tool |
| [`write-excel-file`](https://gitlab.com/catamphetamine/write-excel-file) | CSV to Excel (real `.xlsx`, values kept as text) |

### Build pipeline

- [`satori`](https://github.com/vercel/satori) + [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) — generates the Open Graph image at build time
- [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/) — XML sitemap with per-route priorities and `lastmod`
- IndexNow ping to Bing on deploy

## Analytics

First-party and cookieless, modeled to keep pageviews free:

- **`POST /api/hit`** — a `navigator.sendBeacon` from `BaseLayout` records a pageview into Cloudflare Analytics Engine (dataset `vexyn_web`). No PII is stored; unique visitors are estimated with a per-day rotating hash of IP + user-agent + salt.
- **`GET /api/stats?key=…`** — a key-protected dashboard that queries Analytics Engine via the Cloudflare SQL API.

Only `/api/*` invokes the Worker (`run_worker_first` in `wrangler.toml`); everything else is a static asset.

## Hosting & deploy

- **DNS + CDN + TLS:** Cloudflare
- **Hosting:** Cloudflare Workers Static Assets (auto-deploy on push to `main`)
- **Analytics:** first-party, on Cloudflare Analytics Engine
- **Domain registrar:** Porkbun

## Development

Requires Node 22+.

```bash
git clone https://github.com/andreicristi88/vexyn.git
cd vexyn
npm install
npm run dev           # http://localhost:4321
```

### Scripts

```bash
npm run dev           # dev server with HMR
npm run build         # generate-logos + generate-og + astro build → ./dist
npm run preview       # serve the built site
npm run og            # regenerate the OG image only
```

### Architecture

```
src/
├── components/
│   ├── layout/          # Header, Footer
│   ├── ui/              # Logo, Faq, PrivacyNote, RelatedReading, RelatedGuides
│   └── tools/           # One Svelte component per tool
├── content/
│   └── blog/            # Guides (Markdown), one per tool
├── layouts/
│   └── BaseLayout.astro # SEO, meta, JSON-LD, theme bootstrap, analytics beacon
├── lib/
│   ├── constants.ts     # Site config
│   ├── tools.ts         # Tool registry (single source of truth)
│   ├── seo.ts           # JSON-LD schema helpers
│   ├── statement.ts     # Statement parsing / categorization / recurring detection
│   ├── matcher.ts       # Deterministic transaction matching
│   ├── exporters.ts     # Multi-format export (CSV, QuickBooks, Xero, QIF, JSON)
│   └── stripe.ts        # Stripe payments / payouts / balance reconciliation
├── pages/               # One .astro per tool + home, about, privacy, 404, blog
└── styles/
    └── global.css       # Tailwind + theme variables + dark/light tokens
worker/
└── index.ts             # /api/hit + /api/stats (Analytics Engine)
```

Adding a tool means: a Svelte component, an Astro page, an entry in the registry, and a guide. Footer and homepage grid update from the registry automatically.

## Hard rules for tools

1. **Must run 100% in the browser.** No server roundtrip for the user's file, ever.
2. **No user accounts.**
3. **Scope privacy claims to the file.** "Your file is never uploaded" is true and provable; "no cookies / no tracking / no ads" is not — ads fund the site.
4. **Correctness first.** Financial tools that are subtly wrong are worse than no tool.
5. **Open-source, license-compatible dependencies only.**

## License

MIT — see [LICENSE](LICENSE).
