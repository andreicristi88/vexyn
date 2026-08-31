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
  bg: '#0c1116',
  surface: '#151c24',
  border: '#263441',
  brand: '#10b981',
  accent: '#14b8a6',
  text: '#e7edf3',
  textMute: '#93a1b0',
  textDim: '#647585',
  success: '#10b981',
};

// Shield V logo, scaled to 96px for OG header
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="96" height="96">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#14b8a6"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0c1116"/>
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
        backgroundImage: `radial-gradient(circle at 30% 0%, rgba(16,185,129,0.20), transparent 55%), radial-gradient(circle at 90% 100%, rgba(20,184,166,0.14), transparent 60%)`,
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
    title: 'Financial data tools that never leave your device.',
    subtitle: 'Free tools to clean, convert and analyze CSVs, bank exports and Stripe reports — all in your browser. No upload, no signup.',
    badge: null,
  },
];

console.log('[og] Generating OG images...');
for (const page of pages) {
  await render(page.filename, template(page));
}
console.log('[og] Done.');
