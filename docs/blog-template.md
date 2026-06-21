# Vexyn blog — article template & rules

This is the authoritative pattern for every article on `vexyn.app/blog/`.
Modelled on the folositor.ro guide structure, which has proven SEO traction.

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
title: <topic action> — <year> step-by-step guide
description: <150-160 char summary that matches search intent>
pubDate: YYYY-MM-DD
updatedDate: YYYY-MM-DD   # optional, set when re-editing significantly
tags: ['primary-topic', 'category', 'guide']
related: ['/tool-slug-1', '/tool-slug-2']
---
```

**Schema is defined in `src/content.config.ts`** — update there if fields change.

---

## Title formula

`{Verb-led intent} — {year} step-by-step guide`

Examples:
- `How to remove EXIF metadata from your photos — 2026 step-by-step guide`
- `How to merge PDFs without uploading them — 2026 step-by-step guide`
- `How to remove background from images without uploading — 2026 step-by-step guide`
- `How to transcribe audio for free — 2026 step-by-step guide`

Why:
- **"How to" + verb** matches the dominant query pattern for the SEO category we want
- **Year** is a freshness signal Google now weighs heavily on how-to content
- **"step-by-step guide"** matches what users search for *and* tells Google the page is a how-to (it'll try the HowTo rich result)

Avoid:
- Clickbait ("The ONE trick…", "You won't believe…")
- Brand-first titles ("Vexyn EXIF Remover — how to use it")
- Vague titles ("EXIF metadata: a complete look")

---

## Section structure (in order)

### 1. Intro paragraph (no heading, just text)

2-4 sentences. Establish what the article covers and who it's for. Plain language, no marketing tone. End with one sentence summarising what the rest of the guide will do.

### 2. `## Before you start — <context>`

Background a reader needs before the steps make sense. Short. Bullet list if you're enumerating components (e.g. what's in EXIF). Paragraph if explaining context.

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
- **First mention of a Vexyn tool**: link to the tool page. `[Vexyn's EXIF Remover](/exif-remover)`.
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

See `src/content/blog/what-is-exif-metadata-and-how-to-remove-it.md` for
the canonical example that follows this template exactly. Match its
structure; adapt the content.

---

## Article ideas backlog (prioritised by search volume × low difficulty)

1. **How to merge PDFs without uploading them — 2026 step-by-step guide**
   (~3k/mo, low difficulty, links to /pdf-merger)
2. **How to remove background from images without uploading — 2026 step-by-step guide**
   (~5k/mo, links to /background-remover)
3. **How to transcribe audio for free without uploading — 2026 step-by-step guide**
   (~2k/mo, links to /audio-transcriber)
4. **How to split a PDF without uploading — 2026 step-by-step guide**
   (~1k/mo, links to /pdf-splitter)
5. **How to extract color palette from an image — 2026 step-by-step guide**
   (~1k/mo, links to /color-palette)
6. **WebP vs AVIF vs JPEG: which image format to use in 2026**
   (~12k/mo, harder, links to /image-converter)
7. **WebGPU explained: running AI in your browser without an API**
   (~1k/mo, more technical/devy, links to all AI tools)
8. **Best privacy-first PDF tools in 2026 (no upload required)**
   (~1.5k/mo, listicle format — slight deviation from template)
