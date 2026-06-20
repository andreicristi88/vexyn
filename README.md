# Vexyn

> Tools that stay on your device.

[![Live site](https://img.shields.io/badge/live-vexyn.app-6366f1?style=flat-square)](https://vexyn.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-a855f7?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/andreicristi88/vexyn?style=flat-square&color=10b981)](https://github.com/andreicristi88/vexyn/stargazers)

A growing collection of free browser tools that run **entirely on your device**. No file uploads. No signup. No tracking. No ads. The kind of tools you'd want if you treated your data the way you treat your medical history.

🌐 **[vexyn.app](https://vexyn.app)**

---

## What this is

The web is full of "free" tools that quietly upload your files, log your usage, sell your data, or wrap everything in a paywall on the third use. Vexyn is the opposite — every tool is JavaScript (sometimes WebAssembly, sometimes WebGPU) that loads into your browser and runs locally on your CPU or GPU. Files dropped into Vexyn never make a single network request.

Close the tab and everything is gone.

## Why

- **Privacy by architecture, not by promise.** Most online tools say "we don't store your data." We can't — there is no server to store on. Verify in your browser's Network tab.
- **No accounts, ever.** Friction-free. Open, do the thing, close.
- **Zero ads, zero trackers.** Cloudflare Web Analytics for traffic counts; no cookies, no fingerprinting.
- **Genuine offline support.** Once a tool's assets are cached, it works on a plane.
- **Open source.** Every line is in this repo. Audit, fork, copy.

## Tools

All run client-side. None upload anything.

| Tool | What it does |
|------|--------------|
| [**JSON Formatter**](https://vexyn.app/json-formatter) | Format, validate, minify JSON. |
| [**Base64 Encoder**](https://vexyn.app/base64) | Encode/decode with UTF-8 support. |
| [**QR Code Generator**](https://vexyn.app/qr-generator) | Custom colors, PNG/SVG export. |
| [**PDF Merger**](https://vexyn.app/pdf-merger) | Combine PDFs, drag to reorder. |
| [**PDF Splitter**](https://vexyn.app/pdf-splitter) | Split into pages or extract a range. |
| [**Image Compressor**](https://vexyn.app/image-compressor) | JPG, PNG, WebP, HEIC. Web Worker. |
| [**Image Format Converter**](https://vexyn.app/image-converter) | Batch JPG ↔ PNG ↔ WebP ↔ AVIF. |
| [**EXIF Remover**](https://vexyn.app/exif-remover) | Strip GPS and camera metadata. |
| [**Color Palette Extractor**](https://vexyn.app/color-palette) | Dominant colors as HEX/RGB/HSL/CSS. |
| [**AI Background Remover**](https://vexyn.app/background-remover) | RMBG-1.4 via WebGPU. **No API.** |

More tools land regularly. See the [issues](https://github.com/andreicristi88/vexyn/issues) tab for what's planned.

## The cost of running this

**$15/year.** That's the domain.

Hosting is Cloudflare Pages (free, unlimited bandwidth). The AI background remover uses an open-source model served from the Hugging Face CDN, cached in your browser after first load — Vexyn's own infrastructure never sees it. No API providers. No per-request costs. Whether 10 or 10 million people use Vexyn next month, the bill stays at $15.

This is the entire economic premise: by pushing the work to the user's device, an entire class of "freemium" pressure disappears.

## Tech stack

- **[Astro 6](https://astro.build)** — static-site framework with islands architecture
- **[Svelte 5](https://svelte.dev)** — interactive islands, runes API
- **[Tailwind CSS 4](https://tailwindcss.com)** — styling via Vite plugin
- **[TypeScript](https://www.typescriptlang.org)** — strict mode

### Per-tool libraries

| Library | Used by |
|---------|---------|
| [`pdf-lib`](https://github.com/Hopding/pdf-lib) | PDF Merger, PDF Splitter |
| [`@huggingface/transformers`](https://github.com/huggingface/transformers.js) | Background Remover (WebGPU + WASM fallback) |
| [`browser-image-compression`](https://github.com/Donaldcwl/browser-image-compression) | Image Compressor (Web Worker) |
| [`qrcode`](https://github.com/soldair/node-qrcode) | QR Generator |
| [`exifr`](https://github.com/MikeKovarik/exifr) | EXIF Remover (metadata parsing) |
| [`jszip`](https://github.com/Stuk/jszip) | PDF Splitter (per-page ZIP output) |

### Build pipeline

- [`satori`](https://github.com/vercel/satori) + [`@resvg/resvg-js`](https://github.com/yisibl/resvg-js) — generates per-page Open Graph images at build time
- [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/) — XML sitemap with priorities and `lastmod`
- GitHub Actions → IndexNow ping to Bing/Yandex/Seznam/Naver/Yep on every deploy

## Hosting & deploy

- **DNS:** Cloudflare
- **CDN + TLS:** Cloudflare
- **Hosting:** Cloudflare Pages (auto-deploy on push to `main`)
- **Analytics:** Cloudflare Web Analytics (privacy-friendly, no cookies)
- **Domain registrar:** Porkbun
- **AI model CDN:** Hugging Face Hub (one-time download, then browser-cached)

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
npm run build         # generate-og + astro build → ./dist
npm run preview       # serve the built site
npm run og            # regenerate OG images only
```

### Architecture

```
src/
├── components/
│   ├── layout/          # Header, Footer
│   ├── ui/              # Logo, ToolCard, ThemeToggle
│   └── tools/           # One Svelte component per tool
├── layouts/
│   └── BaseLayout.astro # SEO, meta, theme bootstrap
├── lib/
│   ├── constants.ts     # Site config
│   ├── tools.ts         # Tool registry (single source of truth)
│   └── seo.ts           # JSON-LD schema helpers
├── pages/               # One .astro per tool + home, about, privacy, 404
└── styles/
    └── global.css       # Tailwind + theme variables + dark/light tokens
```

The tool registry in `src/lib/tools.ts` is the single source of truth — adding a tool means: a Svelte component, an Astro page, and an entry in the registry. Footer + homepage grid update automatically.

## Contributing

Tool ideas, bug reports, refinements — open an [issue](https://github.com/andreicristi88/vexyn/issues) or a PR.

Hard rules for new tools:

1. **Must run 100% in the browser.** No server roundtrip, no API calls, no exceptions. If a tool can't be built without a backend, it doesn't belong here.
2. **No user accounts.** Ever.
3. **No analytics that follow users.** Cloudflare Web Analytics aggregate counts only.
4. **No dark patterns.** Free means free, not freemium with a meter.
5. **Open source dependencies only.** And license-compatible.

## Acknowledgements

- [BRIA AI](https://huggingface.co/briaai) for releasing **RMBG-1.4** under Apache 2.0.
- [Xenova](https://github.com/xenova) for the heroic work that became `transformers.js`.
- The [`pdf-lib`](https://github.com/Hopding/pdf-lib) maintainers for a clean, dependency-free PDF library.
- [Mike Kovařík](https://github.com/MikeKovarik) for [`exifr`](https://github.com/MikeKovarik/exifr) — the fastest browser-native EXIF parser available.
- [Donald](https://github.com/Donaldcwl) for [`browser-image-compression`](https://github.com/Donaldcwl/browser-image-compression) with proper Web Worker support.
- The Astro, Svelte, and Tailwind teams for tools that make a project like this maintainable solo.

## License

MIT — see [LICENSE](LICENSE).
