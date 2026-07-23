export const SITE = {
  name: 'Vexyn',
  url: 'https://vexyn.app',
  title: 'Vexyn — AI Image Generator That Runs In Your Browser',
  description:
    'Free AI image generator. Runs entirely on your device — your prompts never reach a server. No account, no queue, no limits.',
  // Note: 'no upload', 'no signup', 'no queue' are architectural promises we can
  // keep forever because inference is client-side. Avoid claiming 'no ads' —
  // display ads are the funding model and must not become a broken promise.
  tagline: 'AI images that never leave your device.',
  author: 'Vexyn',
  email: 'support.vexyn@gmail.com',
  github: 'https://github.com/andreicristi88/vexyn',
  twitter: '@vexynapp',
  keywords: [
    'ai image generator',
    'free ai image generator',
    'no signup image generator',
    'stable diffusion browser',
    'local ai image',
    'webgpu',
    'text to image',
    'private ai art',
  ],
};

/**
 * Where the ONNX weights live. Cloudflare R2 gives free egress, so serving
 * ~840 MB per new visitor costs nothing beyond storage.
 *
 * The bucket must send permissive CORS headers, and the files are:
 *   {MODEL_BASE}/runtime.json
 *   {MODEL_BASE}/text_encoder/model.onnx
 *   {MODEL_BASE}/unet/model.onnx
 *   {MODEL_BASE}/vae_decoder/model.onnx
 */
export const MODEL_BASE = 'https://models.vexyn.app/sdxs-512-v1';

/** Base model we ship, for attribution required by its licence. */
export const MODEL = {
  id: 'IDKiro/sdxs-512-dreamshaper',
  url: 'https://huggingface.co/IDKiro/sdxs-512-dreamshaper',
  licence: 'openrail++',
  licenceUrl: 'https://huggingface.co/spaces/CompVis/stable-diffusion-license',
  /** Single denoising step — this is why it is fast enough to run locally. */
  steps: 1,
  resolution: 512,
};

export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
  children?: Array<{ label: string; href: string; description?: string }>;
};

export const NAV: NavItem[] = [
  {
    label: 'Generate',
    href: '/',
    children: [
      { label: 'Anything', href: '/', description: 'The open generator — describe whatever you want' },
      { label: 'Game assets', href: '/game-assets', description: 'Sprites, item icons, concept art for your game' },
      { label: 'Wallpapers', href: '/wallpapers', description: 'Desktop and phone backgrounds' },
      { label: 'Fantasy characters', href: '/fantasy-characters', description: 'D&D portraits, NPCs, party art' },
      { label: 'Stickers & emotes', href: '/stickers', description: 'Discord and Twitch, transparent background' },
    ],
  },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
  { label: 'GitHub', href: 'https://github.com/andreicristi88/vexyn', external: true },
];
