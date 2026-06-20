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
    keywords: ['pdf', 'merge', 'combine'],
    available: false,
  },
  {
    slug: 'image-compressor',
    name: 'Image Compressor',
    description: 'Compress JPG, PNG, WebP without quality loss. 100% local.',
    category: 'image',
    icon: '🖼',
    keywords: ['image', 'compress', 'optimize', 'jpg', 'png', 'webp'],
    available: false,
  },
  {
    slug: 'background-remover',
    name: 'Background Remover',
    description: 'Remove image backgrounds locally with WebGPU AI. No upload.',
    category: 'ai',
    icon: '✨',
    keywords: ['background', 'remove', 'ai', 'webgpu'],
    available: false,
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
