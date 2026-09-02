# Vexyn blog — article template & rules

This is the authoritative pattern for every article on `vexyn.app/blog/`.
Modelled on the folositor.ro guide structure, which has proven SEO traction.

> **Update (Sep 2026), finance era — read this first.** The live guides now
> use conventions that override some of the older rules below. When they
> conflict, follow these:
> - **Title:** plain `How to <do the thing>` — no `— 2026 step-by-step guide`
>   suffix. Freshness comes from `pubDate`, not the title. Match the live
>   guides (e.g. "How to analyze your spending from a bank statement").
> - **`category` is required** in the frontmatter and MUST equal one of the
>   category names in `src/pages/blog/index.astro` (`CATEGORIES`). A new topic
>   area means adding a category there first, or the guide falls into
>   "More guides".
> - **Section headings carry NO "Step N —" prefix.** The guide page
>   auto-numbers every `<h2>` with a CSS counter (badge on the page + matching
>   number in the sticky table of contents), so a manual "Step 1 —" would
>   double-number. Use plain action headings ("Load the statement and scan").
> - **"Sources cited" is optional** for how-to-use-our-tool guides (see
>   `clean-messy-bank-csv.md`), required when you state external facts/specs.
>   NEVER fabricate a citation or a statistic — omit the section rather than
>   invent a source. Correctness outranks the E-E-A-T nicety.
>
> The editorial structure, voice rules and FAQ/Glossary requirements below all
> still apply. The current reference guides are the finance ones in
> `src/content/blog/` (e.g. `analyze-spending-bank-statement.md`).

> For the technical SEO infrastructure that every page (not just blog
> posts) must respect — schema, headings, OG images, internal linking,
> Cloudflare deploy gotcha — see [`seo-checklist.md`](./seo-checklist.md).
> This document focuses on editorial structure and voice.

## Why this structure

Google in 2026 rewards:
- Clear how-to / step-by-step structure for informational and how-to intent
- FAQ sections (eligible for People Also Ask rich snippets)
- E-E-A-T signals (cited sources, real expertise, named author)
- Semantic completeness (glossary, related content, internal linking)
- Freshness (year in title, `pubDate` and optional `updatedDate`)

This template hits all of those without ceremony.

---

## Frontmatter schema

Every article starts with:

```yaml
---
title: How to <do the thing>          # plain, no year/step-by-step suffix
description: <150-160 char summary that matches search intent>
pubDate: YYYY-MM-DD
updatedDate: YYYY-MM-DD   # optional, set when re-editing significantly
category: '<one of CATEGORIES in src/pages/blog/index.astro>'   # required
tags: ['primary-topic', 'category', 'guide']
related: ['/tool-slug-1', '/tool-slug-2']
---
```

**Schema is defined in `src/content.config.ts`** — update there if fields change.

---

## Title formula

`How to {verb-led intent}` — front-load the keyword, no year, no "step-by-step guide" suffix.

Examples:
- `How to clean a messy bank CSV export`
- `How to reconcile Stripe payouts to your bank`
- `How to find every recurring payment in your bank statement`
- `How to calculate MRR, ARR and SaaS metrics`

**Length cap (hard rule):** keep the title short enough that with the `— Vexyn`
suffix BaseLayout appends, the rendered `<title>` stays ≤ ~60 characters — so
the base title is **≤ ~52 characters**. Google truncates past that in the SERP.
If it runs long, drop `How to`, cut filler words (`your`, parentheticals), or
tighten the phrasing — never sacrifice the head keyword. Same cap applies to
tool-page titles.

Why:
- **"How to" + verb** matches the dominant query pattern for the SEO category we want
- **Head keyword first** survives truncation and reads clearly in the SERP

Avoid:
- Clickbait ("The ONE trick…", "You won't believe…")
- Brand-first titles ("Vexyn CSV Cleaner — how to use it")
- Vague titles ("Bank CSVs: a complete look")
- Titles that render over ~60 chars total (see the length cap above)

---

## Section structure (in order)

### 1. Intro paragraph (no heading, just text)

2-4 sentences. Establish what the article covers and who it's for. Plain language, no marketing tone. End with one sentence summarising what the rest of the guide will do.

### 2. `## Before you start — <context>`

Background a reader needs before the steps make sense. Short. Bullet list if you're enumerating components (e.g. which columns a tool needs). Paragraph if explaining context.

### 3. `## Step 1 — <action>`, `## Step 2 — <action>`, etc.

The core of the article. Sequential, action-oriented. 3-5 steps is the sweet spot. Each step:
- Starts with a one-sentence summary of what this step accomplishes
- Then specific instructions
- Use `### Sub-method` H3s when the step has alternatives (e.g. Windows / macOS / Linux instructions, or Browser tool / Command line / Desktop app)

### 4. `## Common mistakes to avoid`

Bullet list. 4-6 items. Each one names a specific mistake with one sentence on why it's a mistake. This section captures long-tail queries like "why does X fail" and "what to do if Y" — high engagement, high SEO value.

### 5. `## Frequently asked questions`

Each question is its own H3. 5-8 questions. Each answer is 1-3 sentences. Phrase questions exactly how a user would search — natural language, no jargon.

Frequent question patterns to consider:
- "Does X reduce Y?" (quality, speed, accuracy)
- "Will Z know?" (the receiver, the platform)
- "What about <related format / case>?" (PNG, HEIC, mobile)
- "Is X enough for <high-stakes use>?"
- "Can I batch / automate?"

### 6. `## Related guides`

2-4 internal links to other Vexyn tools or guides. Each is a one-sentence sell of why a reader who finished this guide might want it next. Drives dwell time + Vexyn-internal authority.

### 7. `## Sources cited in this guide`

2-5 external authoritative sources used in writing the guide. Official specs, manufacturer docs, primary research. **No filler links to Wikipedia for everything.** Real citations.

E-E-A-T impact is significant. Skipping this section hurts ranking.

### 8. `## Glossary`

Define 4-8 terms a non-expert reader might not know. Each is a paragraph (not just a one-liner) with enough context to actually be useful. Glossary entries are semantic-completeness signals.

---

## Writing voice rules

After the HN flagging incident (June 2026), assume any visibly AI-generated
text will hurt us on community platforms. SEO content on our own domain is
less brittle, but the same principles produce better-quality writing anyway:

### Do
- Specific concrete examples ("a 2019 Pixel 4 photo from Berlin")
- Honest about limitations and trade-offs
- Mention real failure modes (X doesn't work when Y)
- Mix paragraph and list formats
- Vary sentence length — some short, some longer
- Use the second person ("you") to address the reader directly

### Avoid
- Em-dash overuse — one or two per article max
- "Notably", "Furthermore", "Moreover", "In essence", "It's worth noting"
- Every section the same length (5 sentences each)
- Every H3 the same shape ("How to X" repeated)
- Generic phrases ("a comprehensive guide", "everything you need to know")
- Lists where every bullet is parallel-structured ("X improves Y. Z improves W.")
- Marketing tone ("revolutionize", "seamlessly", "powerful")

### Pre-publish self-check
Read the article out loud. If a sentence sounds like a corporate blog,
rewrite it. If three sentences in a row have the same rhythm, vary one.

---

## Length

**1500-2500 words** is the target for primary articles. Long enough for SEO
authority on competitive queries, short enough to be readable.

If a topic legitimately needs more (deep technical guides), go longer.
If a topic only needs less (very narrow question), it's probably not a
standalone article — make it an FAQ entry on a tool page instead.

---

## Internal linking

Inside the article body:
- **First mention of a Vexyn tool**: link to the tool page. `[Vexyn's CSV Cleaner](/csv-cleaner)`.
- **Subsequent mentions**: plain text. Don't over-link.
- **Cross-link to other blog articles** when relevant. Use the `related` frontmatter for tool/page references at the bottom.

External links:
- All external links must `target="_blank" rel="noopener noreferrer"`. (Astro markdown handles this automatically in most cases — check after build.)

---

## Pre-publish checklist

Before merging an article PR (or pushing direct to main):

- [ ] Frontmatter complete (title, description, pubDate, tags, related)
- [ ] Description is 150-160 characters and matches likely search intent
- [ ] Title contains current year and "step-by-step guide"
- [ ] All 8 required H2 sections present in order
- [ ] At least 4 numbered steps (or justified why fewer)
- [ ] FAQ has 5+ questions
- [ ] At least 2 internal links to Vexyn tools
- [ ] At least 2 external citations in the Sources section
- [ ] Glossary has 4+ entries
- [ ] Word count 1500+
- [ ] Read aloud — no AI tells (em-dash spam, "notably", "in essence")
- [ ] Build passes locally (`npm run build`)
- [ ] Sitemap auto-includes the new URL after build

---

## Reference article

See `src/content/blog/clean-messy-bank-csv.md` for a canonical example that
follows this template. Match its structure; adapt the content.

---

## Article ideas backlog

Every tool in the registry now has a matching guide (see each tool's `related`
frontmatter for the mapping). New guide ideas should either:

- **Deepen an existing tool's cluster** — an adjacent search intent that still
  funnels to a shipped tool (e.g. an accounting-software-specific import angle
  that points at CSV to QBO / OFX).
- **Answer an informational query** the tools imply but don't directly serve
  (e.g. `What is a good net worth by age?` → Net Worth Analyzer), where the
  guide earns the traffic and the tool is the call to action.

Do not write a guide for a tool that doesn't exist yet — build the tool first,
then the guide, so every guide has a working destination.
