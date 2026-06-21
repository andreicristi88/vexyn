---
title: How to remove EXIF metadata from your photos — 2026 step-by-step guide
description: A step-by-step guide to stripping EXIF, GPS, and camera metadata from JPEG, PNG, and HEIC photos. Covers what's hidden in the file, how to see it, three removal methods, and how to verify nothing is left.
pubDate: 2026-06-22
tags: ['privacy', 'images', 'metadata', 'guide']
related: ['/exif-remover', '/image-compressor']
---

Every photo your phone or camera saves carries a hidden block of text alongside the pixels: the EXIF metadata. It can include the GPS coordinates of where you took the shot, the exact second it was taken, the model of your camera, and a list of every editor that touched the file since. When you share that photo over email, chat, Slack, or a forum, the metadata usually goes along for the ride.

This guide walks through four practical steps to remove it, with three concrete methods to choose from depending on whether you prefer a browser tool, a command line, or a plain image viewer.

## Before you start — what gets stored in a photo

A typical phone photo from 2024 onwards carries:

- **GPS coordinates** with latitude, longitude, and altitude
- **Capture timestamp** down to the second, with timezone
- **Camera and lens information**: make, model, firmware
- **Exposure settings**: aperture, shutter speed, ISO, focal length
- **Software trail**: every app that opened and re-saved the file
- **An embedded thumbnail**, sometimes containing the un-cropped original
- **Color profile** and rendering hints

This information is useful for photographers and editing software. It is mostly invisible to you in normal use, which is the problem: you don't think about it, you don't see it, and it leaves your computer every time you share the file.

Social networks like Twitter, Instagram, Facebook, and LinkedIn strip EXIF on upload (most of the time). Direct file shares almost never do — email attachments, Discord, Slack, AirDrop, Dropbox links, Google Drive shares, and forum uploads all preserve the original metadata.

## Step 1 — See what is actually in your photos

Before stripping anything, take a quick look at one of your own photos. The numbers stop feeling abstract once you see your bedroom's GPS coordinates spelled out.

### On Windows
Right-click any image, choose **Properties**, switch to the **Details** tab. Scroll down to GPS, Camera, and Origin sections.

### On macOS
Open the photo in **Preview**, then **Tools → Show Inspector** and click the **(i)** tab. Look for GPS and EXIF panels.

### On Linux
From a terminal, run:

```
exiftool photo.jpg
```

The full dump prints to your terminal. Pipe to `less` for long photos.

### In a browser
Drop the file into [Vexyn's EXIF Remover](/exif-remover). It parses metadata in JavaScript without uploading the file, then shows a flag if GPS coordinates were present.

The first time you do this with a photo you've shared online, the result is usually surprising.

## Step 2 — Pick a removal method

There are three practical options. Pick based on how often you do this and how much friction you can tolerate.

### Method A — Browser tool (fastest for one-off)

Open a tool like [Vexyn's EXIF Remover](/exif-remover), drop the file, click Download. The tool re-encodes the image in your browser and gives you a clean copy back. Nothing is uploaded. You can verify by opening DevTools, switching to the Network tab, and watching it stay empty while you process a file.

Best for: one photo, a handful, occasional use, no install.

### Method B — ExifTool (best for bulk)

[ExifTool](https://exiftool.org) is the canonical command-line tool. Once installed:

```
exiftool -all= photo.jpg
```

For an entire folder, recursive:

```
exiftool -all= -r ~/photos
```

ExifTool keeps a backup of the original file with `_original` appended unless you pass `-overwrite_original`.

Best for: large batches, scripting, archival workflows.

### Method C — Re-save in a simple viewer (no install)

Opening a JPEG in **Microsoft Paint** and pressing Save produces a copy without EXIF. Most basic image viewers behave the same way because they don't know how to write the metadata block back. On macOS, opening in Preview and exporting as JPEG also drops most metadata.

This works but it has two downsides: you have to remember to do it, and it subtly re-encodes the image (slightly different bytes). For provenance-sensitive work (legal, journalism, archival) that matters. For sharing a vacation photo it doesn't.

Best for: occasional use, no patience for installing anything.

## Step 3 — Verify the metadata is actually gone

Don't trust silently. Open the cleaned file in the same viewer you used for Step 1 and confirm GPS, Camera, and Date Taken fields are empty (or missing entirely).

A common mistake: some tools strip *visible* EXIF but leave XMP or IPTC blocks intact. ExifTool's `-all=` removes everything; the browser-based re-encode also clears all blocks. Anything that targets only "EXIF" by name can miss XMP.

## Step 4 — Strip filename and look at visible content

Removing metadata is not the same as anonymizing a photo. Two things still leak after you strip EXIF:

**Filename.** `IMG_20240614_142233.jpg` still contains the exact capture date and time in the name. Rename the file to something neutral before sharing.

**Visible content.** Street signs, room layouts, reflections in glass, the EXIF readouts in screenshots, faces, distinctive backgrounds — none of these are touched by metadata removal. Look at the photo with fresh eyes and ask what someone determined could infer from what they can see.

## Common mistakes to avoid

- **Forgetting that screenshots also have metadata.** A screenshot of an EXIF viewer obviously does. But even a regular screenshot has the timestamp of when it was taken, plus often the device's username path in the temporary filename.
- **Trusting "edit and crop" to remove a thumbnail.** Some image editors save a pre-edit thumbnail inside the metadata. If you crop out a sensitive part of an image and don't strip metadata, the un-cropped thumbnail can sometimes be recovered.
- **Sharing the same photo with two different identities.** Sensor noise patterns are subtle but distinguishable; researchers can sometimes link two photos to the same camera based on noise alone. Metadata removal does not fix this.
- **Stripping EXIF from a copy while the original sits in a cloud backup.** Google Photos, iCloud, and OneDrive all keep the original EXIF on their servers. If the threat model includes the cloud provider, stripping the share copy is not enough.
- **Trusting the chat app to strip it.** Some do, some don't, and behaviour changes between versions. Always strip before sharing if it matters.

## Frequently asked questions

### Does removing EXIF reduce image quality?

Slightly, if the tool re-encodes the file. JPEG is lossy, so each save loses a tiny bit. For a normal share, the loss is invisible. For high-fidelity archival work, use ExifTool's strip-only mode (no re-encode) instead of a browser re-save.

### Will the receiver know I stripped the metadata?

Not directly. A clean photo just looks like a photo. The absence of metadata is normal for files that have been shared on most major platforms. There is no "stripped" flag.

### Do PNG files have EXIF?

Less commonly than JPEG, but yes — PNG supports text metadata chunks (tEXt, iTXt, zTXt) and many cameras and editors write EXIF-equivalent info into them. Strip with the same tools.

### What about HEIC (iPhone) files?

HEIC files have the same metadata structure as JPEG (often more, because Apple's pipeline adds extra fields). Strip the same way. Most browser tools that handle HEIC will also strip its metadata on re-encode.

### Is removing EXIF enough for journalistic-grade source protection?

No. For source protection, the threat model is much wider: sensor noise fingerprints, device-specific encoding quirks, network-side metadata, and the visible content of the frame all matter. Talk to a digital security professional if the stakes are that high.

### Can I batch-strip a whole library at once?

Yes. ExifTool's `-all= -r ~/photos` walks every file recursively. For a browser tool, drop multiple files at once if the tool supports it (Vexyn's does).

## Related guides

When you're done stripping metadata, you may want to:

- [Compress images without uploading them](/image-compressor) — re-save photos for the web at a smaller file size, also strips metadata as a side effect.
- [Convert between image formats privately](/image-converter) — switch JPG to WebP/AVIF locally.

## Sources cited in this guide

- [EXIF 2.32 specification (CIPA)](https://www.cipa.jp/std/documents/e/DC-008-Translation-2019-E.pdf)
- [ExifTool documentation](https://exiftool.org)
- [W3C PNG specification — text chunks](https://www.w3.org/TR/PNG/#11textinfo)

## Glossary

**EXIF** — Exchangeable Image File Format. A standardized way for cameras to embed technical and contextual metadata into JPEG and HEIC files.

**IPTC** — International Press Telecommunications Council. A metadata standard used by newsrooms to attach captions, credits, and copyright info.

**XMP** — Extensible Metadata Platform. An Adobe-developed standard for embedding editing history and arbitrary metadata. Often coexists with EXIF in the same file.

**Re-encode** — The act of decoding the image to raw pixels and then encoding it again. Drops most metadata as a side effect because the new encoder doesn't carry over the old blocks.

**Sensor noise fingerprint** — A subtle, per-device pattern of pixel-level noise that can identify which camera took a photo, given enough samples. Not removed by stripping metadata.

**Quiet zone (in this context)** — The visible content of a photo (reflections, backgrounds, faces) that still leaks information even after metadata is gone.
