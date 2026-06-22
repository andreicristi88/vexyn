---
title: How to transcribe audio for free without uploading — 2026 step-by-step guide
description: A practical guide to converting audio recordings to text on your own machine. Three concrete methods (browser AI, desktop Whisper, paid services), with notes on language detection, file formats, and exporting subtitle files.
pubDate: 2026-06-22
tags: ['audio', 'ai', 'privacy', 'guide']
related: ['/audio-transcriber', '/blog/how-to-remove-background-from-images-without-uploading']
---

Audio transcription used to mean either paying a service to do it, paying a human, or accepting that the free options would upload your recording to someone else's server. For voice memos with personal thoughts, internal meeting recordings, interviews you promised to keep off the record, or anything containing client details, none of those options are great.

In 2026 you can transcribe most audio entirely on your own machine. The same OpenAI Whisper model that powers many paid services is open source and now runs in browsers via WebGPU. This guide covers three concrete methods, the limits of each, and how to get clean transcripts as TXT, SRT, or VTT files.

## Before you start — what works and what doesn't

A few quick reality checks before picking a method:

- **Clear speech is the sweet spot.** Voice memos, podcasts, interviews, meeting recordings — these all transcribe well. Music with lyrics, songs, heavy background noise, multiple overlapping speakers all degrade quality fast.
- **Auto-detect language is unreliable for short clips.** If you know the language, pick it manually before starting. The model commits to a language guess in the opening seconds; a bad guess produces nonsense for the rest of the file.
- **Length affects method choice.** Anything under ten minutes: browser tool is fine. Anything over an hour: command-line is more reliable because browser memory eventually runs out.
- **Single channel is enough.** Whisper resamples to 16 kHz mono internally. Stereo recordings get downmixed automatically — no quality benefit from sending stereo.
- **Background noise hurts more than you'd think.** A quiet office is fine. A coffee shop with music produces 20-40% worse accuracy. If you have the raw recording and can re-do it in a quieter environment, do that first.

## Step 1 — Prepare your audio file

Most modern formats work directly: MP3, WAV, M4A, OGG, FLAC, AAC, OPUS, WEBM. If your file is in something unusual (Sony LPEC, older AMR codec from Nokia phones, raw PCM), convert it first.

Quick conversions with ffmpeg:

```
ffmpeg -i recording.wma -ar 16000 -ac 1 recording.wav
```

That gives you 16 kHz mono WAV, which is what Whisper wants internally anyway. Most browser-based transcribers handle the conversion for you, but if you're hitting odd format errors this is the safe path.

For very long recordings (multi-hour podcast, full lecture, meeting that ran over), consider trimming the audio first. Even fast transcription gets tedious to babysit at 4-hour scale.

## Step 2 — Pick a transcription method

Three honest options based on your situation.

### Method A — Browser tool (best for one-off and short clips)

Drop the file into [Vexyn's Audio Transcriber](/audio-transcriber). It runs Whisper Tiny (~75 MB) or Whisper Base (~145 MB) entirely in your browser via WebGPU, with WASM fallback for older devices. The model downloads once and caches forever after.

Set the language manually unless you're sure auto-detect will work (use auto-detect only for clear English speech longer than 30 seconds). Click play and wait. The progress bar moves with elapsed time, so you can step away.

When done, the transcript appears with optional timestamps. Copy to clipboard, or download as plain text, SubRip (.srt), or WebVTT (.vtt) for video subtitles.

Best for: voice memos, single interviews, short podcast clips, meeting recordings under an hour. Anything you'd otherwise upload to a website to transcribe.

Trade-offs:
- First load is slow (model download). Subsequent uses are instant.
- WASM fallback on weak devices runs at 1-2x audio length. WebGPU on a decent desktop is 5-10x faster than realtime.
- Very long files eat browser memory.

### Method B — Local Whisper (best for batch and long files)

The reference implementation is [OpenAI's Whisper](https://github.com/openai/whisper) on Python. The faster, lighter option is [whisper.cpp](https://github.com/ggerganov/whisper.cpp), a C++ port that runs on CPU efficiently and supports the same models.

With whisper.cpp on a recent Mac:

```
brew install whisper-cpp
whisper-cpp -m models/ggml-base.bin -f recording.wav --output-srt
```

On Linux or Windows, build from source or use a pre-built binary. The same model files work across platforms.

Best for: scripted batch jobs, hours-long recordings, archival workflows, situations where you want explicit control over model size and precision.

Trade-offs:
- Install required.
- Model files are larger downloads (`ggml-base.bin` is ~150 MB; bigger models go up to 3 GB).

### Method C — Paid services (when accuracy matters more than privacy)

Otter.ai, Rev.com, Descript, Trint, and similar services upload your audio to their servers and run larger, proprietary models. The quality jump from Whisper Base (free, local) to Whisper Large or proprietary commercial models is real for hard audio (heavy accents, overlapping speakers, noisy environments).

Best for: legal proceedings, professional journalism where the source already agreed to share, podcasts being produced commercially, content where accuracy is worth more than privacy.

Trade-offs:
- Your audio leaves your device.
- Monthly subscription or per-minute pricing.
- Some services retain audio indefinitely for training.

## Step 3 — Verify the transcript

Don't trust silently. For a 10-minute clip, spot-check at three places:

- **First 30 seconds.** This is where language auto-detect either nailed it or got it wrong. If the opening looks like nonsense in the wrong language, your auto-detect failed — re-run with manual language selection.
- **A specific moment you remember.** Pick a phrase you know was said, search the transcript for it. If it's missing or garbled, the model struggled there.
- **The last 30 seconds.** Long recordings sometimes drift quality at the end. Confirm the closing isn't truncated or hallucinated.

Common quality issues:

- Speaker names rendered as generic placeholders (Whisper doesn't do speaker diarization by default).
- Acronyms spelled out wrong (model heard "SQL" as "sequel" or similar).
- Numbers transcribed as words instead of digits ("two thousand twenty four" instead of "2024").
- Wrong language committed to in the first seconds. Always preventable by selecting language manually.

For ten minutes of clear English speech, expect 95%+ accuracy from Whisper Base on a clean recording. Below 90% means something is wrong with the input (noise, accent, format) and worth investigating before continuing.

## Step 4 — Export as TXT, SRT, or VTT

Three common output formats serve different purposes:

- **TXT** — plain transcript text. For research notes, blog post drafts, searchable archives.
- **SRT** (SubRip) — the most widely supported subtitle format. Drop into any video editor or upload to YouTube as captions.
- **VTT** (WebVTT) — modern web subtitle format. Use for HTML5 `<track>` elements on your own site.

Vexyn's transcriber exports all three from the same UI. For Whisper.cpp, pass `--output-srt`, `--output-vtt`, or `--output-txt` flags.

If you're feeding into a video editor, SRT is almost always the right pick. If you're hand-editing the transcript first, work in TXT and convert at the end.

## Common mistakes to avoid

- **Trusting auto-detect on short clips.** Always select the language manually if you know what it is. Auto-detect has a 5-10% failure rate that ruins everything downstream.
- **Transcribing music expecting lyrics.** Whisper is trained on spoken speech. Song lyrics produce hallucinations or nonsense. Use a lyric-specific service instead.
- **Sending audio to a free upload-based service when the content is sensitive.** Many free services retain audio indefinitely. Read the terms before uploading anything you wouldn't post publicly.
- **Trying to transcribe a 4-hour meeting in the browser.** Split into chunks of 30-60 minutes first. Browser memory limits will bite eventually.
- **Editing the transcript in the same tool that generated it.** Copy the text to a proper editor (even a basic text editor) before doing substantial cleanup. Browser textareas are bad for long-form editing.
- **Forgetting to set speaker labels manually.** Whisper doesn't identify who said what. If you need it for an interview transcript, add the labels yourself in the editing pass.

## Frequently asked questions

### How accurate is Whisper Base compared to Otter.ai or Rev?

For clear English speech in a quiet recording, Whisper Base reaches 90-95% word accuracy. Paid commercial services typically hit 95-98% on the same audio. The gap widens for hard audio (multiple speakers, heavy accents, noisy environments) where commercial services use larger proprietary models.

### Can Whisper transcribe other languages?

Yes. Whisper supports 99 languages. Major European languages, Mandarin, Japanese, Hindi, Arabic, and others work well. Smaller languages (Romanian, Czech, Hungarian) work but with somewhat lower accuracy than English. Always select the language manually for non-English audio.

### Does it work for two-speaker interviews?

It transcribes both speakers fine but doesn't label who is speaking when. For interview workflows you'll need to add speaker labels yourself, or use a separate speaker diarization tool first.

### Can I transcribe a YouTube video?

You can't drop a YouTube URL directly into Whisper — first extract the audio with yt-dlp (`yt-dlp -x --audio-format mp3 URL`), then drop the resulting MP3 into your transcription tool.

### What about timestamps? Can I get them per word?

Whisper produces timestamps at the chunk level (every 5-30 seconds of audio). Word-level timestamps require a different model or a post-processing step. For subtitle work, chunk-level is usually fine.

### Is my audio really not uploaded?

In Vexyn's browser tool: confirmed, no. Open DevTools, switch to the Network tab, run a transcription, and see for yourself — no outgoing requests during processing. The model file downloads once at startup and then stays cached. For desktop tools (whisper.cpp), it's also entirely local. For commercial services, your audio definitely uploads.

### Why is the first run so slow?

First run downloads the model (75-145 MB for Whisper Tiny / Base). After that, it's cached in your browser. Subsequent transcriptions start immediately. Whisper.cpp follows the same pattern with locally stored models.

### Can I redact sensitive info from the transcript automatically?

Not directly within Whisper. The transcript is just text once produced — use any text editor's find-and-replace, or pipe it through a redaction tool of your choice. Some commercial transcription services offer built-in redaction for medical or legal use cases.

## Related guides

- [Remove EXIF metadata from photos](/blog/what-is-exif-metadata-and-how-to-remove-it) — same privacy principle, different file type.
- [Merge PDFs without uploading](/blog/how-to-merge-pdfs-without-uploading) — handy if your transcription work ends up being attached to a document bundle.

## Sources cited in this guide

- [OpenAI Whisper paper (Radford et al., 2022)](https://cdn.openai.com/papers/whisper.pdf)
- [whisper.cpp GitHub project](https://github.com/ggerganov/whisper.cpp)
- [@huggingface/transformers (transformers.js) documentation](https://huggingface.co/docs/transformers.js/)
- [ffmpeg documentation](https://ffmpeg.org/documentation.html)

## Glossary

**Whisper** — An open source automatic speech recognition model released by OpenAI in late 2022, available in sizes from Tiny (75 MB) to Large (~3 GB). Multilingual and freely usable under MIT.

**WebGPU** — A modern browser API that exposes the user's GPU to JavaScript for general-purpose compute. Required for Whisper to run at usable speed in the browser.

**WASM (WebAssembly)** — A binary instruction format for the web that runs at near-native speed. Used as a fallback when WebGPU isn't available. Slower than WebGPU but works almost everywhere.

**Quantization** — Reducing the precision of model weights (from 32-bit floats to 8-bit integers, for example) to shrink download size and memory use. q8 quantization is standard for browser-based Whisper.

**Speaker diarization** — Identifying which speaker is talking at each moment in a multi-speaker recording. A separate task from transcription; Whisper doesn't do it natively.

**SRT (SubRip Subtitle)** — A widely supported plain-text subtitle format with timestamps. Drop into any video editor or upload to YouTube as captions.

**VTT (WebVTT)** — The modern web subtitle format. Used by HTML5 `<track>` elements for in-browser video captioning.
