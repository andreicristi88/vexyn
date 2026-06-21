---
title: What is EXIF metadata, and how to remove it from your photos
description: EXIF tags can reveal where a photo was taken, what camera shot it, and when. Here is what gets embedded, why it matters, and how to strip it without uploading the file anywhere.
pubDate: 2026-06-22
tags: ['privacy', 'images', 'metadata']
related: ['/exif-remover']
---

Every photo your phone or camera saves carries a small block of hidden text alongside the pixels. That block is called **EXIF**, short for *Exchangeable Image File Format*. It was invented in the late 1990s to help cameras pass technical settings (shutter speed, ISO, lens model) between devices and editing software. Useful for photographers. Quietly invasive for everyone else.

A photo you upload to a forum, send in a chat, or share in a Slack thread usually still has the original EXIF block embedded. Whoever receives it can read it with a one-line script, a metadata viewer, or even just the file properties pane on Windows.

This article covers what's actually in there, why it matters, and how to strip it without uploading your file to a third-party site.

## What gets stored in EXIF

The exact list depends on the device that produced the photo, but a typical phone snap from 2024 onwards carries something like this:

- **Camera information**: make, model, lens, firmware version
- **Capture settings**: aperture, shutter speed, ISO, focal length, white balance
- **Timestamp**: the exact second the photo was taken, with timezone
- **GPS coordinates**: latitude, longitude, altitude, and sometimes a heading
- **Orientation**: which way the camera was held
- **Software info**: any editing app that touched the file, and when
- **Thumbnail**: a small embedded preview, sometimes the original pre-edit version
- **Color profile** and other rendering hints

Some images also carry **IPTC** (used by news agencies to attach captions and credits) and **XMP** (used by Adobe products for editing history). These are separate metadata blocks but they live in the same file and travel together.

## Why this matters

For most everyday photos this is harmless. For a few specific cases it isn't.

**Location leakage.** Phone photos have GPS on by default. If you post a photo of your living room online, the EXIF block can reveal your home address to anyone who downloads the file. There have been well-documented cases of stalkers and abusive ex-partners locating victims this way. Even seemingly anonymous photos of pets, drawings, or food can betray a precise location.

**Pattern matching.** Even without GPS, the combination of camera model, software version, and timestamp can act like a fingerprint. If someone wants to link photos from multiple accounts back to a single person, EXIF data makes it trivial.

**Old edits surfacing.** Some editors save a thumbnail of the original photo inside the metadata. If you crop a sensitive part of an image and don't strip metadata, the original uncropped thumbnail can still be recovered from the file. This has caused real news incidents.

**Time-of-day disclosure.** A photo of an empty office at 2:14 AM with the timezone embedded tells a story you might not want to tell.

Social networks like Twitter, Facebook, Instagram, and LinkedIn usually strip EXIF on upload, but the behavior is inconsistent. Direct file shares (email attachments, Discord, Slack, forum uploads, AirDrop, Google Drive, Dropbox shared links) almost always preserve the original metadata.

## Where you can see EXIF for yourself

Before stripping it, it's worth seeing what's actually in your photos. A few quick ways:

- **Windows**: right-click any image > Properties > Details. Scroll to see GPS, camera, and timestamp fields.
- **macOS**: open in Preview > Tools > Show Inspector > the (i) tab. Look for GPS and EXIF sections.
- **Linux**: `exiftool photo.jpg` from the terminal prints everything.
- **In the browser**: drop your file into [Vexyn's EXIF Remover](/exif-remover). It parses the metadata client-side and shows you what was there, before stripping it.

The first time you do this with a phone photo you've shared online, the result is usually surprising.

## How to strip EXIF

There are three honest options.

### 1. Re-save the image in software that drops metadata

Opening a JPEG in MS Paint and pressing Save will produce a copy without EXIF, because Paint doesn't write the metadata block back. Most simple image viewers behave the same way. The downside is that you have to remember to do this, and it's awkward for batches.

This also subtly re-encodes the image, which changes its bytes slightly. For most uses that's fine. For provenance-sensitive work (legal, journalism, archival) it can matter.

### 2. Use a desktop tool like ExifTool

[ExifTool](https://exiftool.org) is the canonical command-line tool. To strip everything:

```
exiftool -all= photo.jpg
```

For a whole folder:

```
exiftool -all= -r ~/photos
```

ExifTool is exhaustive and correct, but installing a command-line tool is overkill if you just want to share three vacation photos without leaking your hotel address.

### 3. Use a browser tool that doesn't upload

The third option is to drop the file into a web page that does the same job in JavaScript, without sending the photo anywhere. This is what [Vexyn's EXIF Remover](/exif-remover) does. The image is parsed and re-encoded entirely inside your browser tab. You can verify nothing is uploaded by opening DevTools, switching to the Network tab, and watching it stay empty while you process a file.

For a single photo or a small batch, that's usually the fastest path. You see the metadata that was there, you click download, you get a clean copy. No install, no command line, no upload.

## What stripping EXIF does *not* do

Removing metadata is not the same as anonymizing a photo. Some things still leak:

- **Visible content**: street signs, room layouts, reflections in glass, people's faces, distinctive backgrounds. Metadata removal does nothing about these.
- **Pixel-level forensics**: cameras leave subtle sensor noise patterns that can sometimes be linked back to a specific device, given enough samples. This is academic for most people but real for high-stakes situations.
- **Filename**: `IMG_20240614_142233.jpg` still contains a timestamp. Rename the file before sharing.
- **Reverse image search**: if the photo (or a similar one) has been posted elsewhere with your name attached, search engines can find it. Stripping EXIF from your copy doesn't unpublish other copies.

So removing EXIF is a real privacy improvement, but it's one layer among several. If you're sharing a photo that absolutely cannot be traced to you, consider what's *visible* in the frame just as carefully.

## A short workflow that covers most cases

For everyday photo sharing where you'd just rather not broadcast your location and timestamps:

1. Drop the file into a metadata viewer. Confirm what's actually in there.
2. Run it through a stripper (browser tool, ExifTool, or re-save in a simple viewer).
3. Re-check with the viewer to confirm the GPS and timestamp fields are gone.
4. Rename the file if the original name encodes a date.
5. Look at the visible content with fresh eyes for things you didn't notice the first time.

That takes about a minute per photo and removes the easiest 90% of accidental privacy leaks.

---

If you want to try the browser-based approach, [Vexyn's EXIF Remover](/exif-remover) is free and runs entirely on your device. Source code is on [GitHub](https://github.com/andreicristi88/vexyn).
