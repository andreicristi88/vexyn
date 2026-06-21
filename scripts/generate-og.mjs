// Generates OG images (1200x630) at build time using Satori + Resvg.
// One default + one per available tool. Run from `npm run build`.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const COLORS = {
  bg: '#0a0a0f',
  surface: '#13131a',
  border: '#2a2a36',
  brand: '#6366f1',
  accent: '#a855f7',
  text: '#f0f0f5',
  textMute: '#9090a0',
  textDim: '#606070',
  success: '#10b981',
};

// Shield V logo, scaled to 96px for OG header
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="96" height="96">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0a0a0f"/>
  <path d="M32 7 L54.5 15 L54.5 33 C54.5 44.5 44.5 54 32 57.5 C19.5 54 9.5 44.5 9.5 33 L9.5 15 Z" fill="url(#g)"/>
  <path d="M21.5 27.5 L32 43.5 L42.5 27.5" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
const LOGO_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString('base64')}`;

// Load Geist fonts (.woff — satori supports woff but not woff2)
const fontDir = resolve(root, 'node_modules/@fontsource/geist-sans/files');
const [fontRegular, fontMedium, fontBold] = await Promise.all([
  readFile(`${fontDir}/geist-sans-latin-400-normal.woff`),
  readFile(`${fontDir}/geist-sans-latin-500-normal.woff`),
  readFile(`${fontDir}/geist-sans-latin-700-normal.woff`),
]);

const fonts = [
  { name: 'Geist', data: fontRegular, weight: 400, style: 'normal' },
  { name: 'Geist', data: fontMedium, weight: 500, style: 'normal' },
  { name: 'Geist', data: fontBold, weight: 700, style: 'normal' },
];

/**
 * @param {{ title: string, subtitle: string, badge?: string }} opts
 */
function template({ title, subtitle, badge }) {
  return {
    type: 'div',
    props: {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background: COLORS.bg,
        backgroundImage: `radial-gradient(circle at 30% 0%, rgba(99,102,241,0.25), transparent 55%), radial-gradient(circle at 90% 100%, rgba(168,85,247,0.18), transparent 60%)`,
        fontFamily: 'Geist',
        color: COLORS.text,
        position: 'relative',
      },
      children: [
        // Top: logo + badge
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: '20px' },
                  children: [
                    {
                      type: 'img',
                      props: {
                        src: LOGO_DATA_URI,
                        width: 72,
                        height: 72,
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { fontSize: '40px', fontWeight: 600, letterSpacing: '-0.02em' },
                        children: 'Vexyn',
                      },
                    },
                  ],
                },
              },
              badge
                ? {
                    type: 'div',
                    props: {
                      style: {
                        padding: '10px 18px',
                        borderRadius: '999px',
                        border: `1px solid ${COLORS.border}`,
                        background: COLORS.surface,
                        fontSize: '20px',
                        color: COLORS.textMute,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      },
                      children: badge,
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },

        // Middle: title + subtitle
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '76px',
                    fontWeight: 700,
                    letterSpacing: '-0.035em',
                    lineHeight: 1.05,
                    color: COLORS.text,
                  },
                  children: title,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: '30px',
                    color: COLORS.textMute,
                    lineHeight: 1.35,
                  },
                  children: subtitle,
                },
              },
            ],
          },
        },

        // Bottom: privacy line
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: '12px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: COLORS.success,
                  },
                  children: '',
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '22px', color: COLORS.textDim },
                  children: '100% client-side — no upload, no signup, no tracking',
                },
              },
            ],
          },
        },
      ],
    },
  };
}

/**
 * @param {string} filename
 * @param {object} element
 */
async function render(filename, element) {
  const svg = await satori(element, { width: 1200, height: 630, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const png = resvg.render().asPng();
  const outPath = resolve(root, 'public', filename);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, png);
  console.log(`  ✓ ${filename} (${(png.length / 1024).toFixed(1)} KB)`);
}

// --- Page definitions ----------------------------------------------------
const pages = [
  {
    filename: 'og-default.png',
    title: 'Tools that stay on your device.',
    subtitle: 'Free browser tools that never upload your files. No signup, no tracking — just tools that work, locally.',
    badge: null,
  },
  {
    filename: 'og/json-formatter.png',
    title: 'JSON Formatter',
    subtitle: 'Format, validate and minify JSON in your browser. Your data never leaves your device.',
    badge: 'Developer',
  },
  {
    filename: 'og/base64.png',
    title: 'Base64 Encoder & Decoder',
    subtitle: 'Encode or decode Base64 instantly. Full UTF-8 support. Nothing uploaded, ever.',
    badge: 'Developer',
  },
  {
    filename: 'og/qr-generator.png',
    title: 'QR Code Generator',
    subtitle: 'Customizable QR codes with PNG and SVG export. No redirects, no tracking pixels.',
    badge: 'Generator',
  },
  {
    filename: 'og/pdf-merger.png',
    title: 'PDF Merger',
    subtitle: 'Combine PDFs in your browser. Drag to reorder. Your files never get uploaded.',
    badge: 'PDF',
  },
  {
    filename: 'og/image-compressor.png',
    title: 'Image Compressor',
    subtitle: 'Compress JPG, PNG and WebP locally. Adjustable quality. Zero uploads.',
    badge: 'Image',
  },
  {
    filename: 'og/background-remover.png',
    title: 'AI Background Remover',
    subtitle: 'WebGPU-powered background removal that runs on your device. No upload. No API.',
    badge: 'AI · Local',
  },
  {
    filename: 'og/audio-transcriber.png',
    title: 'AI Audio Transcriber',
    subtitle: 'OpenAI Whisper, running in your browser. 99+ languages. No upload. No API. No signup.',
    badge: 'AI · Local',
  },
  {
    filename: 'og/image-upscaler.png',
    title: 'AI Image Upscaler',
    subtitle: 'Sharpen and enlarge images 2× or 4× with Swin2SR running on your device. No upload. No API.',
    badge: 'AI · Local',
  },
  {
    filename: 'og/pdf-splitter.png',
    title: 'PDF Splitter',
    subtitle: 'Split a PDF into single pages or extract a custom range. Everything stays local.',
    badge: 'PDF',
  },
  {
    filename: 'og/exif-remover.png',
    title: 'EXIF Remover',
    subtitle: 'Strip GPS, camera and timestamp metadata from photos. Privacy-first, local-only.',
    badge: 'Privacy',
  },
  {
    filename: 'og/color-palette.png',
    title: 'Color Palette Extractor',
    subtitle: 'Pull dominant colors from any image. HEX, RGB, HSL, CSS variables. Zero uploads.',
    badge: 'Generator',
  },
  {
    filename: 'og/image-converter.png',
    title: 'Image Format Converter',
    subtitle: 'Batch convert JPG, PNG, WebP and AVIF in your browser. No upload, no quota.',
    badge: 'Image',
  },
];

console.log('[og] Generating OG images...');
for (const page of pages) {
  await render(page.filename, template(page));
}
console.log('[og] Done.');
