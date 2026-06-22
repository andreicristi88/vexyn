---
title: Best privacy-first PDF tools in 2026 — no upload required
description: A practical roundup of free PDF tools that process documents locally on your device. Five concrete picks for merging, splitting, compressing, signing, and metadata handling, with honest notes on what each does well and what it doesn't.
pubDate: 2026-06-22
tags: ['pdf', 'privacy', 'tools']
related: ['/pdf-merger', '/pdf-splitter', '/blog/how-to-merge-pdfs-without-uploading']
---

The popular online PDF tools (Adobe Acrobat online, SmallPDF, ILovePDF, PDF24, Sejda) all share one feature you might not have noticed: they upload your file to their servers to process it. For receipts, marketing PDFs, and anything public, that's fine. For contracts, signed agreements, financial statements, medical records, or internal documents, it isn't.

This article is a concrete roundup of the tools you can use instead. Five picks covering the common PDF operations, each chosen because it processes the file on your own device rather than someone else's server. Each entry has honest notes on what it does well and where it falls short.

## Before you start — what to look for

Useful criteria when evaluating a PDF tool for sensitive documents:

- **Where does the processing happen?** Local desktop, local command line, or in your own browser tab is fine. "Cloud" or "in the cloud" with no further detail means upload.
- **Does it work offline?** The simplest verification of "processed locally" is whether you can use it with your internet disconnected. If yes, the file is local. If it errors, the work is happening on someone else's server.
- **Is the source code available?** Open source means anyone can audit how the file is handled. Closed source means trust the vendor's claim.
- **Does it preserve form fields, signatures, and bookmarks?** Cheaper tools often flatten everything to static images, losing structure. The better tools preserve interactive features.
- **Is there a file size or document count limit on the free tier?** If yes, the operator is paying for server-side processing and rationing it. A tool that does local processing has no inherent reason to cap usage.

The picks below all pass the first two tests (local processing, work offline) and all are free.

## Pick 1 — Vexyn PDF Merger / Splitter (browser, no install)

[Vexyn](/pdf-merger) is a collection of browser tools that includes a PDF merger and splitter. Both run entirely in the browser tab using pdf-lib, an open-source JavaScript PDF library.

### Strengths
- No install. Works in any modern browser, desktop or mobile.
- No upload, no signup, no daily limits.
- Drag-and-drop reordering for the merger.
- Range syntax (`1-3, 5, 7-9`) for the splitter.
- Source code on GitHub (MIT license).
- Works offline after first load.

### Weaknesses
- Only merge and split today. Compress, sign, convert-to-Word are not built yet.
- Browser memory caps total work around 500 MB. For 5 GB documents you'll need a desktop tool.
- Mobile transcoding of huge PDFs is sluggish on weak devices.

### Best for
- One-off merges or splits of contracts, statements, signed documents.
- Working from a borrowed computer where you can't install software.
- Anyone uncomfortable uploading sensitive PDFs to a third-party server.

## Pick 2 — qpdf (command line, comprehensive)

[qpdf](https://qpdf.readthedocs.io/) is the canonical open-source command-line PDF tool. It's been actively maintained for over 15 years.

### Strengths
- Handles merge, split, encrypt, decrypt, linearize, repair, optimize.
- Truly arbitrary scale. Has no UI to bottleneck on; happily processes thousands of PDFs in a script.
- Preserves form fields, signatures (where mathematically possible), bookmarks, annotations.
- Open source. Used as a library in many other PDF tools.
- Excellent error messages when something is malformed.

### Weaknesses
- Command line only. There's no UI, no drag-and-drop.
- The flag syntax for some operations is verbose.

### Best for
- Scripted workflows, batch jobs, archival pipelines.
- Anyone comfortable typing commands.
- Operations that don't have a clean GUI equivalent (selective metadata stripping, complex page reordering).

Quick reference for common operations:

```
# Merge
qpdf --empty --pages a.pdf b.pdf c.pdf -- merged.pdf

# Extract a page range
qpdf input.pdf --pages input.pdf 5-12 -- range.pdf

# Split every page into its own file
qpdf --split-pages=1 input.pdf

# Strip metadata
qpdf --replace-input --remove-metadata input.pdf

# Add a password
qpdf --encrypt user owner 256 -- input.pdf encrypted.pdf
```

## Pick 3 — PDFsam Basic (desktop, click-and-drag)

[PDFsam Basic](https://pdfsam.org) is the long-running free desktop PDF tool. The Basic edition is open source; paid editions add OCR and more advanced features. The free version handles merge, split, rotate, and mix.

### Strengths
- Clean drag-and-drop UI. No command line.
- Cross-platform (Windows, macOS, Linux).
- Open source (free version).
- Preserves bookmarks, form fields, and signatures.
- Handles documents up to whatever your machine can fit in memory (much bigger than browser limits).

### Weaknesses
- Java-based. Startup is slower than native tools.
- The free edition prompts you to upgrade to paid for features it doesn't have.
- UI feels dated.

### Best for
- People who prefer drag-and-drop to typing commands.
- Working with very large PDFs (multi-gigabyte) that exceed browser limits.
- Workflows that combine merge and split in the same session.

## Pick 4 — macOS Preview (built-in, surprisingly capable)

If you're on a Mac, Preview already handles a lot of PDF operations and you don't need to install anything.

### Strengths
- Built into every Mac. Zero install.
- Drag pages between PDFs to merge.
- Drag a page out to make a new PDF (split-by-extraction).
- Annotates with markup tools.
- Signs PDFs (with a trackpad-drawn signature or an imported image).
- Compresses on export.
- Preserves form fields and most bookmarks.

### Weaknesses
- macOS only. No equivalent on Windows or Linux.
- Some operations re-encode fonts in ways that subtly change document fidelity. Important for legal/archival work; mostly fine otherwise.
- No batch mode.

### Best for
- One-off Mac users doing occasional PDF edits.
- Anyone who's already got Preview open for viewing.
- Quick markup and signature workflows.

## Pick 5 — ExifTool (for metadata, not editing)

[ExifTool](https://exiftool.org) is the canonical metadata tool for images, but it also handles PDF metadata.

### Strengths
- Reads every PDF metadata block (Document Info, XMP, custom embedded metadata) thoroughly.
- Strips metadata cleanly without re-encoding content.
- Cross-platform.
- Open source.

### Weaknesses
- Command line only.
- Doesn't merge, split, or otherwise edit PDF content. Only metadata.

### Best for
- Cleaning author, software, and editor names out of PDFs before sharing externally.
- Auditing what metadata a PDF you received actually contains.
- Adding required metadata for archival workflows.

Quick reference:

```
# View all metadata
exiftool document.pdf

# Strip everything
exiftool -all= document.pdf

# Set a specific field
exiftool -Title="Public report" document.pdf
```

## Common mistakes when choosing a PDF tool

- **Picking a tool based only on first-page slickness.** The popular online tools have great landing pages and bad privacy properties. The CLI tools have ugly landing pages and great privacy properties. Don't conflate UI quality with software quality.
- **Trusting that "encrypted in transit" makes upload-based tools safe.** Encryption protects the upload from third parties on the network. It does not protect you from the operator's servers, which by definition have to decrypt the file to process it.
- **Using a single tool for every operation.** PDF operations are different enough that the best tool for one is rarely the best for another. A toolkit (browser tool + qpdf + ExifTool) covers more ground than one monolithic app.
- **Ignoring the operator's privacy policy.** "We delete files after processing" is a different promise than "files never touch our servers." The first requires trust in the operator. The second requires only that you verify the network behavior yourself.
- **Forgetting about local desktop tools you already have.** Preview on macOS is genuinely useful for many tasks. Default desktop PDF viewers usually do more than people realize.

## Frequently asked questions

### Are there local-first alternatives to OCR?

Yes. Tesseract is the open-source OCR engine and runs entirely locally. The accuracy is lower than the proprietary commercial cloud OCR services (Google Cloud Vision, AWS Textract) but is sufficient for most workflows. ocrmypdf wraps Tesseract for batch PDF OCR.

### What about local-first PDF signing?

Vexyn doesn't yet ship signing. PDFsam Basic doesn't either. For local signing, look at LibreOffice Draw (drag-and-drop signing) or pdfsig from Poppler utilities (command line). Adobe Reader on desktop does PDF signing locally and is free.

### Why do free online PDF tools push paid plans so hard?

Server-side PDF processing costs real money. Free tiers are loss-leaders for converting users to paid. Local-first tools have no per-request server costs, so there's no business reason to gate features.

### Can I trust open source PDF tools more than closed source ones?

Open source means anyone can audit the code. In practice, audit doesn't happen for most tools. What open source actually gives you is the option to fork, the ability to read the network calls (none, if it's local-first), and an emergency exit if the maintainer disappears. All meaningful but not the same as "definitely safer."

### What about Adobe Acrobat Reader?

Free desktop Adobe Acrobat Reader works entirely locally. It can view, search, sign, and fill forms without uploading. Adobe's paid online services do upload. The naming gets confusing.

### How do I verify a tool is actually local-first?

Disconnect from the internet, then use the tool. If it works, the processing is local. If it errors, the work was happening on someone else's server.

### What's the biggest PDF I can process in a browser tool?

Roughly 500 MB total on a desktop with 16 GB of RAM. Less on mobile. Command-line tools and dedicated desktop apps scale much higher (multi-gigabyte) because they have access to your full RAM and aren't constrained by browser tab memory caps.

### Do these tools work with password-protected PDFs?

You always need the password to open or modify an encrypted PDF. None of the tools above can bypass that — that's the point of encryption. They will all give a clear error message when handed an encrypted PDF without a password.

## Related guides

- [How to merge PDFs without uploading them](/blog/how-to-merge-pdfs-without-uploading) — deep dive on the merge operation with step-by-step instructions.
- [How to split a PDF into separate pages](/blog/how-to-split-a-pdf-into-separate-pages) — deep dive on splitting.
- [Remove EXIF metadata from photos](/blog/what-is-exif-metadata-and-how-to-remove-it) — same principle for image metadata; same kind of trade-off.

## Sources cited in this guide

- [qpdf documentation](https://qpdf.readthedocs.io/)
- [PDFsam project](https://pdfsam.org)
- [ExifTool documentation](https://exiftool.org)
- [pdf-lib library reference](https://pdf-lib.js.org)
- [PDF 1.7 ISO specification (ISO 32000-1)](https://www.iso.org/standard/51502.html)

## Glossary

**Local-first** — Software that performs its work on the user's device rather than on a remote server. Often used interchangeably with "client-side" for web apps.

**OCR (Optical Character Recognition)** — Converting an image of text (a scan or photo) into selectable, searchable text. A separate, heavier operation than most PDF processing.

**Form flattening** — Converting interactive form fields into static text and drawings. Useful for archival but loses the ability to fill the form later.

**Linearization** — Restructuring a PDF so the first page can render before the rest of the file finishes loading. Useful for very large PDFs served on the web.

**Encryption** — Built-in protection in PDF that requires a password. PDFs support both user passwords (for opening) and owner passwords (for restricting edits).

**Bookmarks / outline** — The hierarchical table of contents embedded in a PDF that lets readers jump to sections. Preserved by good merging and splitting tools.

**XMP** — Extensible Metadata Platform, an Adobe-defined metadata standard that lives inside PDFs alongside the older Document Info dictionary.
