import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg } from '@resvg/resvg-js';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({
    params: { slug: post.id.replace(/\.md$/, '') },
    props: {
      title: post.data.title,
      description: post.data.description,
    },
  }));
}

let fontCache: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadFonts() {
  if (fontCache) return fontCache;
  const [regular, bold] = await Promise.all([
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5/files/geist-sans-latin-500-normal.woff').then((r) => r.arrayBuffer()),
    fetch('https://cdn.jsdelivr.net/npm/@fontsource/geist-sans@5/files/geist-sans-latin-700-normal.woff').then((r) => r.arrayBuffer()),
  ]);
  fontCache = { regular, bold };
  return fontCache;
}

let logoCache: string | null = null;
async function loadLogo() {
  if (logoCache) return logoCache;
  const buf = await readFile(resolve('./public/logo-shield-256.png'));
  logoCache = `data:image/png;base64,${buf.toString('base64')}`;
  return logoCache;
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description } = props as { title: string; description: string };
  const fonts = await loadFonts();
  const logoSrc = await loadLogo();

  const markup = html(`
    <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 60px; background: linear-gradient(135deg, rgb(10, 10, 20) 0%, rgb(25, 25, 50) 100%); border-left: 8px solid rgb(99, 102, 241); font-family: Geist;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${logoSrc}" style="width: 56px; height: 56px;" />
        <span style="color: rgb(240, 240, 250); font-size: 28px; font-weight: 700; letter-spacing: -0.01em;">Vexyn</span>
      </div>
      <div style="display: flex; flex-direction: column; margin-top: auto; gap: 24px;">
        <div style="color: rgb(240, 240, 250); font-size: 56px; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em;">${escapeHtml(title)}</div>
        <div style="color: rgb(160, 160, 180); font-size: 26px; line-height: 1.4; font-weight: 500;">${escapeHtml(description)}</div>
      </div>
    </div>
  `);

  const svg = await satori(markup as any, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Geist', data: fonts.regular, weight: 500, style: 'normal' },
      { name: 'Geist', data: fonts.bold, weight: 700, style: 'normal' },
    ],
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

function escapeHtml(s: string): string {
  // Only escape characters that would break HTML parsing in text-content
  // position. Apostrophes / quotes must stay literal because satori-html
  // does not decode the numeric-entity form and would render `&#39;` raw.
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
