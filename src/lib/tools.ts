export type Tool = {
  slug: string;
  name: string;
  description: string;
  category: 'developer' | 'image' | 'pdf' | 'ai' | 'privacy' | 'generator';
  icon: string;
  keywords: string[];
  available: boolean;
};

export const TOOLS: Tool[] = [
  {
    slug: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Format, validate, and minify JSON. Runs in your browser.',
    category: 'developer',
    icon: '{ }',
    keywords: ['json', 'format', 'validator', 'minify', 'beautify'],
    available: true,
  },
  {
    slug: 'base64',
    name: 'Base64 Encoder',
    description: 'Encode or decode Base64 strings. Supports UTF-8 and files.',
    category: 'developer',
    icon: '⇄',
    keywords: ['base64', 'encode', 'decode', 'converter'],
    available: true,
  },
  {
    slug: 'qr-generator',
    name: 'QR Code Generator',
    description: 'Generate customizable QR codes. Download as PNG or SVG.',
    category: 'generator',
    icon: '▣',
    keywords: ['qr code', 'generator', 'png', 'svg'],
    available: true,
  },
  {
    slug: 'pdf-merger',
    name: 'PDF Merger',
    description: 'Combine multiple PDFs into one. Files never leave your device.',
    category: 'pdf',
    icon: '📄',
    keywords: ['pdf', 'merge', 'combine', 'join', 'concatenate'],
    available: true,
  },
  {
    slug: 'image-compressor',
    name: 'Image Compressor',
    description: 'Compress JPG, PNG, WebP locally with adjustable quality. Zero uploads.',
    category: 'image',
    icon: '🖼',
    keywords: ['image', 'compress', 'optimize', 'jpg', 'png', 'webp'],
    available: true,
  },
  {
    slug: 'background-remover',
    name: 'Background Remover',
    description: 'Remove image backgrounds locally with WebGPU AI. No upload, no API.',
    category: 'ai',
    icon: '✨',
    keywords: ['background', 'remove', 'ai', 'webgpu', 'transparent', 'cutout'],
    available: true,
  },
  {
    slug: 'audio-transcriber',
    name: 'Audio Transcriber',
    description: 'Speech-to-text via Whisper, running on your device. 99+ languages. No upload, no API.',
    category: 'ai',
    icon: '🎤',
    keywords: ['transcription', 'speech to text', 'whisper', 'ai', 'subtitles', 'webgpu'],
    available: true,
  },
  {
    slug: 'pdf-splitter',
    name: 'PDF Splitter',
    description: 'Split a PDF into single pages or extract a page range. Runs in your browser.',
    category: 'pdf',
    icon: '✂',
    keywords: ['pdf', 'split', 'extract', 'pages', 'separate'],
    available: true,
  },
  {
    slug: 'exif-remover',
    name: 'EXIF Remover',
    description: 'Strip GPS, camera and timestamp metadata from images. Privacy-first, local-only.',
    category: 'privacy',
    icon: '🛡',
    keywords: ['exif', 'metadata', 'remove', 'privacy', 'gps', 'strip'],
    available: true,
  },
  {
    slug: 'color-palette',
    name: 'Color Palette Extractor',
    description: 'Extract dominant colors from any image. Copy HEX, RGB, HSL. Zero uploads.',
    category: 'generator',
    icon: '🎨',
    keywords: ['color', 'palette', 'extract', 'dominant', 'hex', 'designer'],
    available: true,
  },
  {
    slug: 'image-converter',
    name: 'Image Format Converter',
    description: 'Batch convert JPG ↔ PNG ↔ WebP ↔ AVIF. Drop, choose format, download. Local.',
    category: 'image',
    icon: '⇆',
    keywords: ['image', 'convert', 'jpg', 'png', 'webp', 'avif', 'batch'],
    available: true,
  },
];

export const CATEGORIES = {
  developer: { label: 'Developer', color: 'brand' },
  image: { label: 'Image', color: 'accent' },
  pdf: { label: 'PDF', color: 'brand' },
  ai: { label: 'AI', color: 'accent' },
  privacy: { label: 'Privacy', color: 'success' },
  generator: { label: 'Generator', color: 'brand' },
} as const;
