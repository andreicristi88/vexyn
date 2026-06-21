---
title: How to merge PDFs without uploading them — 2026 step-by-step guide
description: A practical step-by-step guide to combining PDF files locally on your computer. Three concrete methods (browser, command line, desktop), with notes on encrypted PDFs, file size, and verifying the output.
pubDate: 2026-06-22
tags: ['pdf', 'privacy', 'guide']
related: ['/pdf-merger', '/pdf-splitter']
---

Merging two or three PDFs into one is the kind of task that takes ten seconds in theory and twenty minutes in practice once you realise the easy free options all want your file uploaded to their servers. For receipts, marketing PDFs, or anything else public, that is fine. For a stack of signed contracts, a scanned ID, a medical report, or a draft NDA, it is not.

This guide walks through three ways to merge PDFs entirely on your own machine, plus how to verify the result and avoid a few specific failure modes that bite people the first time.

## Before you start — what to check first

A few things are worth knowing before you pick a tool:

- **Size.** Most browser tools handle a few hundred megabytes of PDF total. Command-line tools handle whatever fits in RAM. Desktop apps usually fall somewhere in between.
- **Encryption.** PDFs with a password or with edit-restrictions need the password removed before they can be re-saved. Nearly every merge tool fails (sometimes loudly, sometimes silently) on encrypted inputs.
- **Forms and annotations.** Most good mergers preserve form fields, annotations, and signatures. Cheap online tools often flatten everything to a plain image, which loses the form data.
- **Page order.** A few seconds renaming the source files so they sort the way you want them merged saves time. `01-cover.pdf`, `02-body.pdf`, `03-appendix.pdf` is much easier to wrangle than three random filenames.
- **Bookmarks and the table of contents.** If the source PDFs have bookmarks, a good merger preserves them. A great merger lets you combine them into one outline. A bad one drops them silently.

If any of these matters for your specific use, pick your tool with it in mind below.

## Step 1 — Get your PDFs in the order you want

Decide the order before you start. Open each file once and skim the first page so you know what is what. Then either rename them so the filesystem sort gives you the right order, or pick a tool that lets you drag rows to reorder after import.

Renaming with a numeric prefix is usually the lowest-friction option:

```
01-contract.pdf
02-addendum.pdf
03-signatures.pdf
04-supporting-docs.pdf
```

This works even for tools that just take a folder and merge whatever is inside.

## Step 2 — Pick a merging method

Three honest options. Pick based on how often you do this and how much friction you can tolerate.

### Method A — Browser tool (fastest for occasional use)

Drop the files into a tool like [Vexyn's PDF Merger](/pdf-merger). It runs entirely in your browser using a JavaScript PDF library (pdf-lib). You drag rows to reorder, click Merge, get a single PDF back. Nothing is uploaded. You can confirm by opening DevTools, switching to the Network tab, and watching it stay empty while you process the merge.

Best for: one to ten files, infrequent use, no install, working from a strange computer.

Trade-offs:
- Very large totals (over ~500 MB combined) hit browser memory limits.
- Some tools strip annotations or bookmarks. The good ones preserve them; check the tool's docs.

### Method B — Command line (best for bulk and scripting)

The two canonical tools are **qpdf** (modern, actively maintained) and **pdftk** (older, still works on most systems). Either does merging cleanly.

With qpdf:

```
qpdf --empty --pages contract.pdf addendum.pdf signatures.pdf -- merged.pdf
```

With pdftk:

```
pdftk contract.pdf addendum.pdf signatures.pdf cat output merged.pdf
```

For a whole folder, glob in your shell:

```
qpdf --empty --pages *.pdf -- merged.pdf
```

Files will be merged in the order your shell expands the glob — usually alphabetical, hence the renaming tip above.

Best for: bulk jobs, scripts, archival workflows, situations where you trust your shell more than a UI.

Trade-offs:
- Install required. On macOS, `brew install qpdf`. On Linux, `apt install qpdf` or equivalent. On Windows, qpdf has a standalone binary.
- No visual reordering — order is whatever you pass on the command line.

### Method C — Desktop app (familiar UI, no internet needed)

On **macOS**, Preview can merge PDFs natively. Open the first PDF, open the sidebar (Cmd+Opt+2), then drag the other PDF files onto the thumbnail pane. Save the result with File → Export as PDF.

On **Windows** or **Linux**, [PDFsam Basic](https://pdfsam.org) is the long-running free option. Drag files in, set the order, click Run.

[LibreOffice Draw](https://www.libreoffice.org) can also open and re-export PDFs, but it re-flows the content slightly — best avoided if you need byte-faithful output.

Best for: people who prefer a click-and-drag UI but want to stay off the web for it.

Trade-offs:
- Install required.
- Preview on macOS sometimes alters embedded fonts on save — annoying for documents that depend on exact typography.

## Step 3 — Verify the merged output

Don't trust silently. Open the merged file in a viewer and check:

- All pages are present (count them against the sum of the originals)
- Page order matches what you intended
- Bookmarks and table-of-contents entries are still there (if the originals had them)
- Form fields still work (try clicking one)
- Signatures still validate (right-click the signature, View signature properties)
- File size is roughly the sum of originals (radically smaller means content was dropped)

A common pattern: the merge "works" in that you get a file, but the file is missing the second half because the second source PDF was encrypted and the tool silently skipped it. Always count pages.

## Step 4 — Optional cleanup after the merge

A few things you might want to do once the merge is done.

**Strip leftover metadata.** Each source PDF carries its own author, creation tool, and modification history. After a merge, that gets combined. For sensitive documents, run `qpdf --replace-input --remove-metadata merged.pdf` (or use a dedicated metadata stripper) before sharing.

**Re-compress.** Merged PDFs often have redundant embedded fonts and images. Tools like [Vexyn's PDF Splitter](/pdf-splitter) (re-saving alone helps) or `qpdf --linearize --object-streams=generate` can shrink the file noticeably.

**Add a password if the result is sensitive.** Most viewers support this from the Save dialog; qpdf has `qpdf --encrypt user owner 256 -- merged.pdf encrypted.pdf` for proper AES-256.

**Re-split if you went too far.** If you accidentally combined a few too many docs, [Vexyn's PDF Splitter](/pdf-splitter) can pull pages back out into a separate file.

## Common mistakes to avoid

- **Trusting the page count of the merge tool's "complete" message.** Always open the merged file and count manually. Silent skips on encrypted PDFs are the number-one cause of "I uploaded it and pages were missing."
- **Merging a draft and a final by mistake** because the filenames are similar. Rename to remove ambiguity before merging.
- **Using a free upload-based tool for a contract.** That contract has now been on a server you don't control. Even if it gets deleted later, the transit is the leak.
- **Forgetting to strip metadata before sharing externally.** The merged file inherits author and editor names from every input. Recipients can see them.
- **Re-merging a merge in a loop.** Each round of re-encoding can degrade scanned image quality and grow the file size. Decide the final order once, merge once.
- **Sharing the merged file by the same name as a draft.** Use a clear final filename like `Contract-2026-06-22-signed-merged.pdf`.

## Frequently asked questions

### What's the maximum size I can merge?

Browser tools: roughly 500 MB total on a desktop with 16 GB RAM, less on mobile. Command-line tools: limited only by your disk. Desktop apps vary; PDFsam handles gigabytes if your machine has the memory.

### Will merging hurt the quality of scanned pages?

Pure merging (no re-encoding) is byte-perfect for the content. Re-saving through a viewer that re-encodes images can lose a small amount of quality. qpdf and Vexyn's merger don't re-encode page content — they assemble the pages as-is.

### Can I merge a password-protected PDF without the password?

No. You can't open or re-save an encrypted PDF without its password — that's the point of encryption. Most tools will flag this clearly (Vexyn's merger shows an "Encrypted PDF — remove password first" label). The workaround is to open the PDF in a viewer where you do have the password, then save an unencrypted copy.

### Does merging preserve digital signatures?

Sometimes. Cryptographic signatures are tied to the exact bytes of the signed PDF — if a merge changes any byte of a signed section, the signature becomes invalid. Tools that simply append pages without touching the signed pages preserve signatures. Tools that re-encode break them. If signature validity matters, test on a copy first.

### Why do I see odd extra blank pages after merging?

Some PDFs have a hidden final blank page used for printer duplexing. Merging brings these through and they show up between sections. Use a splitter or page-extractor to remove the blank pages from the merged file.

### Can I merge PDFs and images together?

PDF mergers only merge PDFs. To include an image, first convert the image to PDF (browsers can do this via Print → Save as PDF), then merge. Some tools combine both steps; most don't.

### Is it safe to merge an unfamiliar PDF I downloaded?

Treat the download itself as the risk, not the merge. PDF files can carry malicious JavaScript or exploit payloads. If you don't trust the source, open the file in a sandboxed PDF viewer first (most modern browsers' built-in viewers are sandboxed). Merging itself doesn't make a malicious file more or less dangerous.

### Will the merged file work on phones?

Yes — PDF is the same format whether viewed on desktop, mobile, or e-readers. Page orientation and font embedding carry through.

## Related guides

When you're done merging, the next moves are usually:

- [Split a PDF](/pdf-splitter) if you went too far and need to pull pages back out
- [Strip EXIF and other metadata](/blog/what-is-exif-metadata-and-how-to-remove-it) — the same principle applies to PDF metadata, though tools differ

## Sources cited in this guide

- [qpdf manual](https://qpdf.readthedocs.io/)
- [PDFtk Server documentation](https://www.pdflabs.com/docs/pdftk-cli-examples/)
- [PDF 1.7 ISO specification (ISO 32000-1)](https://www.iso.org/standard/51502.html)
- [pdf-lib library reference](https://pdf-lib.js.org)

## Glossary

**PDF (Portable Document Format)** — A file format for fixed-layout documents that preserves fonts, images, and formatting independently of the device that renders it. Defined by ISO 32000.

**Encryption (in PDFs)** — A built-in protection mechanism that requires a password to open or modify the file. PDFs support both user passwords (for opening) and owner passwords (for editing restrictions).

**Bookmark / outline** — A hierarchical table of contents embedded in the PDF that lets readers jump to specific sections. Good mergers preserve and combine these from the source files.

**Linearization** — A way of re-arranging the bytes of a PDF so that page 1 can be displayed before the rest of the file finishes loading. Mostly a holdover from slow-internet days; still useful for very large files served over the web.

**Form flattening** — Converting interactive form fields into static text + drawings. Some merge tools do this without asking, which loses the ability to fill the form again later.

**Re-encoding** — Decompressing a page's content and recompressing it. Slightly degrades scanned images and can change file size; the better mergers avoid this.

**OCR (Optical Character Recognition)** — Converting an image of text into selectable, searchable text. Often confused with merging; OCR is a separate, much heavier operation.
