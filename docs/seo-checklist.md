# SEO checklist for new pages on Vexyn

Every new page added to Vexyn must match the SEO conventions established
across the existing pages. This document is the source of truth — when
adding a new tool, blog post, alternative, or any other route, walk
through this checklist before committing.

For blog articles specifically, see also [`blog-template.md`](./blog-template.md)
which covers structural and editorial rules. This document covers the
technical SEO infrastructure that every page type must respect.

---

## 1. Use the existing layout and schema helpers

Never write raw `<head>` content. Every page goes through `BaseLayout`,
which already emits:

- Canonical URL (auto-derived from `Astro.url`)
- Open Graph + Twitter Card tags
- Theme-color meta for light + dark
- PWA manifest link
- Font preload
- Skip-to-content link

Import the layout and pass the relevant props:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { breadcrumbSchema, faqSchema, webAppSchema, combineSchemas } from '../lib/seo';
import { SITE } from '../lib/constants';

const title = 'My New Tool';
const description = 'A clear, benefit-led description in 140-160 characters.';
const faqs = [
  { q: 'Question one?', a: 'Answer one.' },
  // ...
];

const schema = combineSchemas(
  webAppSchema({
    name: `${title} — ${SITE.name}`,
    url: `${SITE.url}/my-new-tool`,
    description,
    features: ['Feature 1', 'Feature 2', '...'],
  }),
  breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: title, url: '/my-new-tool' },
  ]),
  faqSchema(faqs),
);
---

<BaseLayout title={title} description={description} image="/og/my-new-tool.png" schema={schema}>
  ...
</BaseLayout>
```

**Mandatory props per page type:**

| Page type     | `title` | `description` | `image`                          | `schema`                                   |
|---------------|---------|---------------|----------------------------------|--------------------------------------------|
| Tool page     | yes     | yes           | `/og/<slug>.png` (custom)        | `webAppSchema + breadcrumbSchema + faqSchema` |
| Blog post     | yes     | yes           | `/og/blog/<slug>.png` (auto)     | `articleSchema + breadcrumbSchema` (in `blog/[...slug].astro`) |
| Alternative   | yes     | yes           | `/og/alternatives-<slug>.png`    | `webAppSchema + breadcrumbSchema + faqSchema` |
| Static page   | yes     | yes           | default `/og-default.png` is OK  | optional; add breadcrumbSchema if depth > 1 |

`title` should be specific and lead with the user intent — `BaseLayout`
appends ` — Vexyn` automatically for non-home pages. Don't add it yourself.

---

## 2. Description: 140-160 characters, benefit-led

The `description` prop powers `<meta name="description">`, OG, and Twitter
cards in one shot. Rules:

- 140-160 characters (Google truncates beyond ~160 in mobile SERP)
- Lead with the concrete user benefit (what they get), not what the tool is
- Include the privacy promise (`No upload`, `runs in your browser`, etc.)
  in tool descriptions — that's the differentiator that wins clicks
- Match the user's likely search intent. If the query is "convert webp to
  jpg free", the description should mention both formats and "free"
- No emoji, no marketing fluff, no all-caps

Good: `Free PDF merger that runs entirely in your browser. Combine multiple PDFs into one, reorder pages with drag-and-drop. Your files never get uploaded.`

Bad: `🚀 The BEST PDF merger ever! Try it now and merge PDFs like a pro.`

---

## 3. Title formula

- **Tool pages**: `<Tool Name>` plain, e.g. `CSV Cleaner`, `Stripe Reconciliation`.
  `BaseLayout` appends ` — Vexyn` (plus `· Free, no upload` for short titles).
- **Blog posts**: `How to <verb>` — front-loaded keyword, no year suffix. Keep the
  base title ≤ ~52 chars so the rendered `<title>` stays ≤ ~60 (see `blog-template.md`).
- **Alternatives**: `A <Competitor> alternative that <differentiator>`
- **Static pages**: Plain descriptor — `About`, `Privacy`, `Blog`

Never stuff keywords. Never repeat the brand name in the page title — the
layout adds it.

---

## 4. Heading hierarchy — strict

Every page must have **exactly one `<h1>`**, and headings must descend
without skipping levels.

- One `<h1>` per page (the page title, large + bold)
- `<h2>` for section headings (no `<h2>` outside content sections)
- `<h3>` for sub-sections — typically FAQ questions, sub-method cards
- Do NOT skip from `<h1>` to `<h3>`
- Do NOT use heading tags for purely visual size (use `class="text-2xl font-bold"` on a `<div>` if it's not a real heading)
- Decorative card titles inside grids should use `<h3>` if they're a
  semantic sub-heading, otherwise plain `<span>` or `<p>` with bold class

Audit before committing: `grep -nE '<h[1-6]' src/pages/<your-new-page>.astro`
should show exactly one h1, then a clean tree.

---

## 5. Cross-link tool pages and blog articles

If your new page relates to an existing piece of content, add bidirectional
links:

### When adding a tool page

Insert `RelatedReading` before the FAQ section if a relevant blog guide
exists:

```astro
import RelatedReading from '../components/ui/RelatedReading.astro';

<RelatedReading articles={[
  { href: '/blog/how-to-<relevant-guide>', title: '...', description: '...' },
  { href: '/blog/<adjacent-topic>', title: '...', description: '...' },
]} />
```

If no blog guide exists yet for this tool, add it to the
[`blog-template.md`](./blog-template.md) backlog so it gets written.

### When adding a blog post

Use `related` in frontmatter to list the tool routes the article supports:

```yaml
related: ['/csv-cleaner', '/bank-csv-formatter']
```

The blog post layout (`blog/[...slug].astro`) auto-renders these as a
"Related tools" aside.

---

## 6. OG image — always per-page

Every page needs its own Open Graph image. Three patterns:

### Tool pages (static, designed manually)
- Place a 1200×630 PNG in `/public/og/<slug>.png`
- Reference via `image="/og/<slug>.png"` on the `BaseLayout`
- Visual style: dark bg, tool icon top-left, tool name large, privacy
  promise as subtitle — match `/public/og-default.png`, which
  `scripts/generate-og.mjs` renders, as the reference

### Blog posts (auto-generated at build time)
- Nothing to do — `src/pages/og/blog/[slug].png.ts` generates one per
  post from frontmatter `title` + `description` using satori + resvg
- Wire-up already done in `blog/[...slug].astro`: `image={\`/og/blog/${post.id.replace(/\.md$/, '')}.png\`}`

### One-off static pages (about, privacy, alternatives index)
- Default `/og-default.png` is acceptable
- If the page is high-value (likely shared), make a dedicated one

**Never** ship a page that falls back silently to `og-default.png` if it
deserves its own. Check before commit: open the deployed page, view source,
verify `og:image` content URL exists with `curl -I`.

---

## 7. Sitemap inclusion is automatic — except…

`@astrojs/sitemap` picks up every file under `src/pages/` automatically.
You don't need to register new pages anywhere.

Exceptions to handle:

- **Pages that should NOT be in sitemap** (thank-you pages, internal
  utility routes): pass `noindex` prop to BaseLayout AND filter from
  sitemap in `astro.config.mjs`'s `serialize` function.
- **High-priority pages** (homepage = 1.0, tools = 0.8, blog = 0.8,
  static pages = 0.3): if your new page deserves non-default priority,
  add it to the `serialize` rules in `astro.config.mjs`.

---

## 8. Schema (JSON-LD) — per page type

The helpers in `src/lib/seo.ts` cover every current need:

- `webAppSchema(opts)` → for tool pages, generates `WebApplication` with
  `applicationCategory`, `Offer { price: 0 }`, `featureList`
- `faqSchema(faqs)` → for any page with a FAQ section. The visible FAQ
  HTML and the JSON-LD MUST share the same source array — don't write FAQ
  copy twice
- `breadcrumbSchema(items)` → for any page deeper than `/`
- `articleSchema` (inline in `blog/[...slug].astro`) → for blog posts;
  uses `BlogPosting` type with author, publisher, datePublished

`combineSchemas(...schemas)` merges them into a single `@graph` JSON-LD
block, emitted by `BaseLayout` if `schema` prop is passed.

**FAQ rule:** if a page has Q&A content visible to users, it MUST have
matching FAQPage schema. The pattern is to define `const faqs = [...]`,
pass to `faqSchema(faqs)`, then `.map()` the same array into the visible
HTML. Single source of truth.

---

## 9. Internal linking opportunities

Every new page should ask: "What existing page on Vexyn relates to this,
and have I linked both directions?"

Required links from a new tool page:
- Header breadcrumb back to Home
- Related blog guide(s) via `RelatedReading` (if any)
- Related tools mentioned in the FAQ or body copy
- Footer is auto-handled (lists all tools + latest 4 articles)

Required links from a new blog post:
- Related tool pages via frontmatter `related`
- Inline contextual links to relevant tools in the body
- Cross-links to other blog posts in "Related guides" section

---

## 10. Image alt text — always

Every `<img>` in components or pages MUST have meaningful `alt`. Decorative
SVGs (icons inside buttons, arrow svgs) can use `aria-hidden="true"`
instead. Never ship `alt=""` for a content image.

Audit: `grep -nE '<img' src/components/ src/pages/` — every match should
have an `alt=` attribute.

---

## 11. Don't contradict the ad-funded model

Display advertising is Vexyn's funding model. Ad networks (AdSense,
Ezoic, and similar) load third-party scripts and set cookies that
**track visitors**. Any claim that ads would falsify must not appear on
the site — and because our whole trust pitch invites people to *open
DevTools → Network and check*, a false claim here is not just off-brand,
it is verifiable-as-false the moment the ads load.

The privacy wedge that still holds — and that we lean on hard — is that
**the user's file never leaves their browser**. That stays true with ads
on the page: ad scripts run in the page, but they never touch the CSV you
dropped in. Scope every privacy claim to *the file / your data*, never to
*the page / the site as a whole*.

What we CAN safely promise (architectural guarantees about the file):
- **No upload** — your file is processed by client-side code and never
  sent to a server; verifiable by watching for a request that carries
  *your file* out
- **No signup / no accounts** — no auth code in the site
- **Your data never leaves your browser** — the file and its contents
  stay on the device

What we must NOT promise (an ad network breaks each of these):
- **"No ads"** / "ad-free" — ads are the funding model
- **"No tracking"** / "we don't track you" — ad networks track
- **"No cookies"** / "no third parties" — ad scripts set both
- **"Nothing is sent"** / "no requests fire" / "nothing goes out" — the
  page makes ad requests; only *your file* is never sent
- "No watermarks", "forever free for this feature" — leave room to change

Replacement phrasings:

| Don't write | Write instead |
|---|---|
| "No ads, no signup, no tracking" | "No upload, no signup, no accounts" |
| "Open Network — nothing is sent" | "Open Network — your file is never sent out" |
| "we do not track you" | "your files never leave your browser" |
| "no requests fire" | "no request carries your file out" |
| "ad-laden online tools" | "upload-based online tools" |

This rule is **also documented in `src/lib/constants.ts`** as a top-of-
file comment so anyone editing the SITE copy doesn't reintroduce a
forbidden claim by accident.

Audit — both must return only this checklist plus the constants.ts note:
- `grep -irE 'no ads|no-ads|ad-free|ad-laden|without ads|zero ads' src/ docs/`
- `grep -irE 'no tracking|do not track|no cookies|nothing is sent|no requests fire|nothing goes out' src/ docs/`

---

## 12. Don't name competitors in general prose

Commercial competitor names (QuickBooks, Xero, FreshBooks, Baremetrics,
ChartMogul, ProfitWell, Bank2QBO, MoneyThumb, etc.) belong **only** on a
dedicated `/alternatives/<slug>` page, where the comparison is the point
and a "verify before relying" disclaimer sits under the table.

There are **no `/alternatives/*` pages today.** Until one exists, treat
this as: do not name commercial competitors anywhere. Naming the
*software you import into* is different and fine — "a QBO file imports
into QuickBooks" is a format fact, not a commercial comparison.

Anywhere else — tool pages, hub pages, blog posts, homepage — use
**generic phrasing**:

| Don't write | Write instead |
|---|---|
| "QuickBooks, Xero and FreshBooks charge…" | "Most accounting suites charge a monthly subscription…" |
| "Bank2QBO converts CSVs for $40" | "Most desktop CSV-to-QBO converters are paid, one-off licences" |
| "Baremetrics and ChartMogul upload your Stripe data…" | "Most SaaS analytics services connect to and store your Stripe data…" |
| "Stripe charges 2.9% + 30¢" (as a fixed fact) | "Stripe deducts a per-transaction processing fee" |
| "compared to Baremetrics or ChartMogul" (FAQ heading) | "compared to paid analytics services" |

**Why:** competitor pricing, retention policies, feature sets, and free-
tier limits change. A blog post claiming "Service X retains files for 24
hours" becomes false the moment they update the policy. Maintaining
those claims across the whole site is impossible. The `/alternatives/*`
pages are the bounded surface where we *do* make explicit comparisons —
each one has a clearly visible "verify before relying" disclaimer under
the side-by-side table, and the maintenance contract is "review when
the competitor materially changes."

**What is OK to name anywhere:**

- Open-source projects and libraries we use or recommend (papaparse,
  write-excel-file, SheetJS, LibreOffice, GnuCash) — factual
  references, not commercial claims
- Browser names when discussing feature support (Chrome, Firefox,
  Safari, Edge) — these are technical facts that change slowly and
  are independently verifiable
- File formats and the specs behind them (OFX, QIF, QBO/Web Connect,
  INTU.BID, xlsx) — technical facts, not service comparisons
- Operating systems (Windows, macOS, Linux, iOS, Android) — same
  reason as browsers
- Tools the user pairs with our output (Photoshop, GIMP, Figma, Canva,
  Word, Excel) when listing what they'd use alongside Vexyn — these
  are workflow companions, not competitive comparisons

**When you must name a competitor outside `/alternatives/`:**

If a tool page absolutely needs to mention a competitor by name (e.g.
the user explicitly asks "is this the same as X?"), add a date disclaimer
in the same paragraph: "as of <month year>, <claim>". And add a note in
the page frontmatter or a comment: `<!-- review competitor claims by
<date+6mo> -->`. This makes the staleness explicit and creates a
review trigger.

### Adding a new tool? Update `/alternatives/*` too.

The `/alternatives/*` pages are the only surface where we make explicit
competitor comparisons. When a new tool ships, they go out of date
silently — the page still claims "Vexyn currently has X" with a list
that no longer matches reality.

**Rule:** whenever you add an entry to `TOOLS` in `src/lib/tools.ts`,
walk through every `/alternatives/*.astro` page in the same category
and update:

1. **The FAQ Q that lists what Vexyn ships** (typically "Does Vexyn
   have all the tools X has?" or "Does Vexyn have all of X's
   features?"). Names the full current toolset, calls out what stays
   server-only.

2. **The side-by-side comparison table rows.** If your new tool now
   matches a row the competitor used to dominate (e.g. you added OCR
   and the table said "OCR: No" on the Vexyn side), flip it. If your
   new tool is a category that wasn't in the table at all, add a row
   for it.

3. **The "Pick Vexyn when…" box.** Add the new capability to the list
   of reasons users would pick Vexyn.

4. **The "Pick \<competitor\> when…" box.** Remove the new capability
   from the competitor's advantages if it's no longer their exclusive
   feature.

5. **The `index.astro` cards.** The `vexynTools` array and `angle`
   string for each competitor card. Today these say `['13 PDF tools']`
   — bump the number when the count changes.

Audit before pushing a new tool:

```bash
# Find /alternatives pages that may still claim outdated tool counts
grep -rE 'PDF Merger and PDF Splitter|Merger \+ Splitter today|2 PDF tools|currently has' src/pages/alternatives/
```

This grep should return empty (or only flag rows you've intentionally
left). If anything matches and the claim is stale, update it before
committing the new tool.

**Alternatives pages today: none.**

No `/alternatives/*` pages exist. If a zone (Financial Data, Business
Finance, Personal Finance) ever gets enough tools to justify a
comparison page, add `/alternatives/<competitor>.astro`, list it here,
and re-audit it whenever a tool in that zone ships.

---

## 13. Don't add useless meta tags

The following tags are **NOT** to be added:

- `<meta name="keywords">` — Google ignored since 2009. We stripped it
  from BaseLayout. Don't re-add.
- `<meta name="robots" content="index, follow">` — that's the default,
  declaring it is noise. Only add `noindex, nofollow` when you actively
  want to hide a page.
- `<meta name="revisit-after">`, `<meta name="rating">`, etc. — legacy,
  zero search engine support today.

---

## 14. Pre-commit checklist

Before pushing a new page, verify:

- [ ] Page title is specific, lead with intent, doesn't repeat brand
- [ ] Description is 140-160 chars, benefit-led, mentions privacy where relevant
- [ ] Exactly one `<h1>` on the page; heading hierarchy clean
- [ ] `BaseLayout` props include `title`, `description`, `image`, `schema`
- [ ] Schema combines webApp/article + breadcrumb + faq (whichever apply)
- [ ] OG image exists at the right path (static tool, auto blog, default for static one-offs)
- [ ] Related blog/tool links added via `RelatedReading` or frontmatter `related`
- [ ] All `<img>` have `alt`; decorative SVGs have `aria-hidden="true"`
- [ ] `npm run build` passes with no warnings
- [ ] After deploy: `curl -s https://vexyn.app/<route> | grep -E 'og:image|<title>|description'`
  shows correct values
- [ ] **No claim the ad model breaks** (section 11) — no "no ads", "no
  tracking", "no cookies", or absolute "nothing is sent"; privacy claims
  scoped to *the file*. Audit:
  `grep -irE 'no ads|ad-free|no tracking|do not track|no cookies|nothing is sent|no requests fire' src/`
  should return only the constants.ts note.
- [ ] **No commercial competitor names in body prose** (section 12) — only
  on `/alternatives/*`, of which there are none today.
  Quick audit: `grep -rE 'Baremetrics|ChartMogul|ProfitWell|FreshBooks|Bank2QBO|MoneyThumb' src/pages/ src/content/blog/`
  should return empty. (Naming software you import *into* — QuickBooks,
  Xero, GnuCash — is a format fact and is fine.)
- [ ] **New tool shipped? Update `/alternatives/*`** (section 12 sub).
  If you added an entry to `TOOLS`, walk every alternatives page in
  the same category and refresh the FAQ Q, table rows, Pick boxes,
  and index card. Audit:
  `grep -rE 'PDF Merger and PDF Splitter|Merger \+ Splitter today|2 PDF tools|currently has' src/pages/alternatives/`
  should return empty.

---

## 15. Cloudflare deploy gotcha (current setup)

Vexyn deploys as a **Cloudflare Worker** (Workers Static Assets serving
`./dist`), not Cloudflare Pages. Three files keep this working:

- `wrangler.toml` — declares `[assets]` block, no Worker runtime code
- `.npmrc` with `legacy-peer-deps=true` — required because Cloudflare's
  build env auto-runs `astro add cloudflare` which pulls
  `@astrojs/cloudflare@^14` which peer-requires `astro@^7.0.0-alpha.2`,
  but we're on Astro 6 stable
- `astro.config.mjs` — must NOT reference `adapter: cloudflare()`.
  Output stays static. The adapter is installed on disk but unused.

**Never:** add an Astro adapter to the config, delete `.npmrc`, delete
`wrangler.toml`, or upgrade to Astro 7 without re-evaluating this setup.
If Astro 6 stable gets a compatible `@astrojs/cloudflare` release, the
`.npmrc` can go. Until then, leave it.

---

## Quick reference: file locations

| What                        | Where                                              |
|-----------------------------|----------------------------------------------------|
| Layout (head, schema emit)  | `src/layouts/BaseLayout.astro`                     |
| SEO helpers                 | `src/lib/seo.ts`                                   |
| Site constants              | `src/lib/constants.ts`                             |
| Tool registry               | `src/lib/tools.ts`                                 |
| Related reading component   | `src/components/ui/RelatedReading.astro`           |
| Blog post layout            | `src/pages/blog/[...slug].astro`                   |
| Blog OG generator           | `src/pages/og/blog/[slug].png.ts`                  |
| Blog content schema         | `src/content.config.ts`                            |
| Sitemap config              | `astro.config.mjs` (sitemap integration block)     |
| Static OG images            | `public/og/`                                       |
| Blog editorial template     | `docs/blog-template.md`                            |
| This document               | `docs/seo-checklist.md`                            |
