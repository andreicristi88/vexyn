import { TOOLS, type Tool } from './tools';

export type HubKey = 'pdf' | 'image' | 'ai' | 'developer';

export const HUBS: Record<HubKey, {
  slug: string;
  label: string;
  icon: string;
  tagline: string;
  intro: string;
  seoTitle: string;
  seoDescription: string;
}> = {
  pdf: {
    slug: 'pdf-tools',
    label: 'PDF Tools',
    icon: '📄',
    tagline: 'Privacy-first PDF tools in your browser',
    intro:
      "Most popular online PDF tools work by uploading your file to their servers. For contracts, statements, IDs, or anything sensitive, that's a real trade-off. Vexyn covers the 13 most-used PDF operations entirely client-side. Drop a file, it never leaves your device.",
    seoTitle: 'Free PDF Tools That Run in Your Browser',
    seoDescription:
      '13 privacy-first PDF tools: merge, split, compress, rotate, convert, OCR, unlock, protect, watermark, organize, page numbers, crop. All run in your browser — no upload, no signup, no daily limit.',
  },
  image: {
    slug: 'image-tools',
    label: 'Image Tools',
    icon: '🖼',
    tagline: 'Image tools that stay on your device',
    intro:
      "Compress, convert, strip metadata, remove backgrounds, extract colors — all without uploading. Vexyn's image tools run as JavaScript and WebAssembly in your browser. Same job as the popular upload-based services, with the file staying on your machine.",
    seoTitle: 'Free Image Tools That Run in Your Browser',
    seoDescription:
      '6 privacy-first image tools: compress, format convert, EXIF strip, AI background removal, color palette extraction. No upload, no signup, no monthly cap.',
  },
  ai: {
    slug: 'ai-tools',
    label: 'AI Tools',
    icon: '✨',
    tagline: 'AI that runs on your own device',
    intro:
      "Three tools that use real AI models — OpenAI Whisper, BRIA RMBG-1.4, Tesseract — running directly in your browser via WebGPU or WebAssembly. No API. No upload. No per-request cost. First visit downloads the model (~75-145 MB); after that the tool works fully offline.",
    seoTitle: 'AI Tools That Run in Your Browser (No API)',
    seoDescription:
      '3 AI tools running on-device via WebGPU: speech-to-text with Whisper, background removal with RMBG-1.4, PDF OCR with Tesseract. No upload, no API key, free unlimited use.',
  },
  developer: {
    slug: 'developer-tools',
    label: 'Developer Tools',
    icon: '{ }',
    tagline: 'Tiny dev tools without telemetry or upload',
    intro:
      "JSON formatting, Base64 encoding, QR code generation — the boring everyday utilities that pop up in dev work. Vexyn's versions are zero-tracker alternatives to the usual upload-based online tools. Everything runs client-side, fast, with a clean UI.",
    seoTitle: 'Free Developer Tools That Run in Your Browser',
    seoDescription:
      '3 privacy-first developer utilities: JSON formatter, Base64 encoder, QR code generator. No signup, no tracking, no upload — clean browser tools that respect your time.',
  },
};

export function toolsForHub(key: HubKey): Tool[] {
  return TOOLS.filter((t) => {
    if (!t.available) return false;
    if (t.category === key) return true;
    if (t.secondaryCategories?.includes(key as any)) return true;
    return false;
  });
}
