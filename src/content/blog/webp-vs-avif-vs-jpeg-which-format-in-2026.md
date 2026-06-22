---
title: WebP vs AVIF vs JPEG — which image format to use in 2026
description: A practical comparison of the three image formats you'll actually use on the web in 2026. Real file size differences, browser support, encoding speed, and when each format wins.
pubDate: 2026-06-22
tags: ['images', 'web', 'guide']
related: ['/image-converter', '/image-compressor', '/blog/what-is-exif-metadata-and-how-to-remove-it']
---

If you build for the web in 2026, you have three image formats worth thinking about: the venerable JPEG, the now-standard WebP, and the increasingly viable AVIF. The wrong choice means slower pages, wasted bandwidth, or surprise compatibility failures on someone's older device.

This guide is opinionated. It tells you which to pick for the use case in front of you, with concrete numbers and the trade-offs that actually matter in practice.

## Quick verdict

If you only read this section, here's the summary:

- **Web product photos, hero images, blog illustrations:** WebP. Universally supported, 25-35% smaller than equivalent JPEG, encoder is fast.
- **High-volume image-heavy sites where every kilobyte counts:** AVIF as the primary format with WebP fallback. AVIF gives another 20-30% size reduction at the cost of slower encoding and slightly more brittle decoding on older devices.
- **Email attachments, archival photos, anything going to a stranger's device:** JPEG. Universal support and 30 years of decoder maturity beat any size advantage.
- **Screenshots, UI elements, anything with transparency or sharp edges:** PNG (not covered here) or WebP. JPEG mangles sharp edges; AVIF is fine but overkill.

The rest of this article justifies these picks and explains the corner cases.

## Before you start — how the formats actually compare

Some numbers from real-world testing, comparing the same source photo (3000×2000, photographic content) encoded at visually-equivalent quality:

- **JPEG quality 85:** 720 KB (baseline)
- **WebP quality 85:** 470 KB (-35% vs JPEG)
- **AVIF quality 60:** 340 KB (-53% vs JPEG, -28% vs WebP)

(AVIF's quality scale is different from JPEG and WebP — AVIF 60 is roughly equivalent to JPEG 85.)

Numbers are approximate. They vary with content: graphics and screenshots see different ratios than photos. But these are reasonable order-of-magnitude figures for typical website hero images.

What this means in practice: a page with 12 product photos at WebP quality 85 will weigh ~5 MB instead of ~8 MB in JPEG. On a slow mobile connection that's roughly 2 seconds saved. AVIF would shave another 1.5 MB.

The trade-off, as always, is encoding cost. AVIF can be 10-50× slower to encode than JPEG. Once encoded, decoding is fine — but if you're generating images at request time (resizing on the fly, building social cards), AVIF's encoding cost is real.

## Format 1 — JPEG (still the safe default in 2026)

JPEG is 33 years old. It is the most universally decodable image format on the planet. Every device made in the last two decades can display it. Cameras shoot it natively. Hardware decoders exist in every smartphone and laptop chip.

### Strengths
- **Compatibility.** No device, browser, email client, or PDF reader has trouble with JPEG.
- **Hardware decoding.** Decode is so fast it's essentially free on modern devices.
- **Mature encoders.** mozjpeg and guetzli produce significantly smaller files than basic JPEG encoders, at no quality cost.
- **Email and document portability.** A JPEG attached to an email or embedded in a PDF will display correctly for everyone.

### Weaknesses
- **No transparency.** JPEG doesn't have an alpha channel. Any image that needs transparent areas needs a different format.
- **File size.** 30-50% larger than WebP at equivalent visual quality. On a mobile-heavy site, this adds up.
- **Block artifacts on sharp edges.** Text in images, screenshots, and UI elements look noticeably worse than in WebP or AVIF at the same file size.

### Pick JPEG when
- You're attaching to email, sharing on chat apps, or sending to a device whose capabilities you don't know.
- You're embedding in a PDF that needs to render on every reader.
- Your source is a photo, the destination is a typical website, and you don't need sub-megabyte files.
- You're working in a workflow where encoder support matters (legacy CMSs, older Photoshop, embedded systems).

## Format 2 — WebP (the current standard for the web)

WebP was developed by Google starting in 2010 and reached usable browser support around 2018. By 2026 it is the default web image format on most production sites.

### Strengths
- **Universal browser support.** Chrome, Firefox, Safari, Edge, all mobile browsers. Even legacy browsers from 2020 onwards.
- **Significant size reduction.** Typically 25-35% smaller than JPEG at equivalent visual quality.
- **Transparency support.** Has an alpha channel, so it can replace PNG for many use cases.
- **Fast encoding.** Not as fast as JPEG, but encoder is mature enough for build-time and request-time use.
- **Native support in image processing libraries.** browser-image-compression, sharp, ffmpeg all handle WebP without ceremony.

### Weaknesses
- **Not universally supported outside browsers.** Email clients, older PDF readers, some chat apps don't render WebP correctly. Saving a WebP and sharing via email will sometimes confuse the recipient.
- **Patent/licensing ambiguity.** WebP is royalty-free but uses VP8 video codec technology. Some legal departments still flag it as ambiguous. Practically a non-issue for web use.
- **Lossy compression of text is OK but not great.** Screenshots with text look better in PNG or AVIF.

### Pick WebP when
- The target is a web browser (almost always, in 2026).
- You need 25%+ size reduction over JPEG with minimal compatibility risk.
- You want a single format that covers both lossy photo compression and transparency.
- You're optimizing for page speed on a typical website.

## Format 3 — AVIF (where the optimization race is now)

AVIF is based on the AV1 video codec. It became practically usable around 2022 and has improved encoder maturity steadily since.

### Strengths
- **Best compression of the three.** 20-30% smaller than WebP, 40-50% smaller than JPEG, at equivalent visual quality.
- **HDR and wide color gamut.** Supports 10-bit and 12-bit color depth, which JPEG can't do at all and WebP can't do well.
- **Browser support is now ubiquitous.** Chrome since 2020, Safari since 2022, Firefox since 2021. Mobile browsers caught up by 2023.
- **Royalty-free.** AV1 was specifically designed to be royalty-free, sidestepping the licensing concerns around HEIC.

### Weaknesses
- **Encoding is slow.** A high-quality AVIF encode of a 3000×2000 photo takes 5-30 seconds depending on encoder settings. AVIF encoders haven't caught up to JPEG/WebP for build-time use at scale.
- **Browser decode is slower** than JPEG or WebP, especially on older mobile devices. For users on 5-year-old phones, AVIF pages may feel less responsive than the same WebP pages.
- **Tooling outside browsers still catching up.** Image editing software has good but not perfect AVIF support. PDF embedding is awkward.
- **Older devices (pre-2020) can't decode.** Always serve WebP or JPEG fallback.

### Pick AVIF when
- You're serving high-volume image content where shaving 20% off image sizes matters at scale (think image-heavy news sites, e-commerce catalogs, image hosting).
- You have build-time encoding capacity (CI/CD jobs, image CDN with offline encoding).
- You can serve a WebP or JPEG fallback for older devices via `<picture>` element.
- HDR or wide-color content matters for your product.

## Common mistakes to avoid

- **Using AVIF as the only format for email or chat attachments.** The recipient's email client probably can't render it.
- **Picking JPEG for screenshots with text.** Block artifacts make the text look bad. Use PNG or WebP.
- **Re-encoding from JPEG to WebP and expecting magic.** WebP is much smaller for the *same visual quality* of the *same source*. Re-encoding an already-compressed JPEG into WebP gets you ~10% reduction at most, not the 35% you'd get from raw input.
- **Serving AVIF without a fallback.** Use the HTML `<picture>` element to serve AVIF first with WebP and JPEG fallbacks. A handful of users will still need them.
- **Compressing at AVIF quality 95 expecting JPEG-equivalent quality.** AVIF quality 60 ~ JPEG quality 85. The scales aren't compatible.
- **Encoding AVIF at request time on a low-CPU server.** Pre-encode at build time. The encoding cost will tank your response times if done on demand.
- **Forgetting that hardware decoders matter for mobile battery life.** WebP and JPEG hardware decoders exist on every modern phone. AVIF hardware decoding is starting to land in 2024-2026 phones but is not universal. For battery-sensitive apps, factor this in.

## Frequently asked questions

### Should I just convert all my JPEGs to AVIF?

Probably not. Re-encoding already-compressed JPEGs gives modest size reductions and adds encoding cost. The big wins come from re-encoding from the original raw or RAW source, or from intercepting at upload time before initial JPEG compression. If you have only the JPEGs, WebP is the better re-encode target because it's faster and the size win is similar to AVIF for already-degraded source.

### Does Google rank WebP higher than JPEG?

No. Google ranks faster pages higher. WebP makes pages faster because it's smaller. That's the indirect SEO benefit. There's no preference for the format itself.

### Can I use AVIF in PDFs?

PDF readers don't natively decode AVIF as of 2026. Embed images in PDFs as JPEG or PNG.

### Does WebP work in iOS Mail?

Modern iOS Mail (iOS 14+, 2020+) decodes WebP. Older versions don't. For email targeting general audiences, JPEG is still safer.

### Which format is best for screenshots?

PNG for screenshots with text or sharp UI elements. WebP if size matters and you can accept slight quality loss on text edges. JPEG is the wrong choice for screenshots — block artifacts on text are very visible.

### How much CPU does AVIF encoding actually take?

Highly variable. Default ffmpeg AVIF settings on a 3000×2000 photo take 5-15 seconds on a modern desktop CPU. Aggressive quality settings can hit 30-60 seconds. Compare to ~0.5 seconds for JPEG encoding.

### Can I batch-convert my existing photos?

Yes. [Vexyn's Image Format Converter](/image-converter) does batch conversion in the browser without uploading. For very large batches (hundreds of files), command-line ffmpeg or sharp via Node is faster.

### What about HEIC?

HEIC (the format iPhones use natively) is HEVC-based and has worse browser support than AVIF. Convert HEIC to WebP or AVIF before publishing to the web.

## Related guides

- [Remove EXIF metadata from photos](/blog/what-is-exif-metadata-and-how-to-remove-it) — applies to all three formats; the metadata structure differs slightly per format.
- [Remove background from images without uploading](/blog/how-to-remove-background-from-images-without-uploading) — adjacent workflow if you're preparing images for the web.

## Sources cited in this guide

- [WebP project documentation](https://developers.google.com/speed/webp)
- [AVIF specification (AOMediaCodec)](https://aomediacodec.github.io/av1-avif/)
- [Can I Use — WebP browser support](https://caniuse.com/webp)
- [Can I Use — AVIF browser support](https://caniuse.com/avif)
- [mozjpeg project](https://github.com/mozilla/mozjpeg)

## Glossary

**Lossy compression** — Compression that discards some image data permanently in exchange for smaller file sizes. JPEG, WebP, and AVIF all support lossy modes.

**Lossless compression** — Compression that reduces file size without discarding any data. PNG is lossless; WebP and AVIF support lossless modes; JPEG does not.

**Alpha channel** — A transparency channel. PNG, WebP, and AVIF support it. JPEG does not.

**Block artifacts** — Visible square-shaped errors that appear in heavily compressed JPEGs, especially around sharp edges and text.

**Hardware decoder** — A dedicated chip on a phone or laptop that decompresses image data without using the main CPU. Matters for battery life and rendering speed on mobile.

**`<picture>` element** — The HTML element used to serve different image formats to different browsers. The browser picks the first source it can decode. Standard way to ship AVIF with WebP and JPEG fallbacks.

**Quality scale** — A number from 0-100 that controls the trade-off between file size and image quality. JPEG, WebP, and AVIF each have their own scale; they're not interchangeable.

**HDR / wide color gamut** — High dynamic range and wider-than-sRGB color spaces. AVIF supports these; JPEG can't; WebP has limited support.
