/**
 * Niche presets. Each one gets its own landing page and pre-loads the generator
 * with style tokens that steer SDXS toward that look.
 *
 * IMPORTANT: SDXS runs a single denoising step with no classifier-free guidance,
 * so there is no negative prompt — it would do nothing. All steering happens
 * through the positive prompt. Do not add a `negative` field and pretend it works.
 */
export type Preset = {
  slug: string;
  /** Page + nav label. */
  name: string;
  /** One line, used on cards and in nav. */
  tagline: string;
  /** Prepended to the user's prompt. Keep short — the encoder truncates at 77 tokens. */
  prefix: string;
  /** Appended after the user's prompt. Style tokens live here. */
  suffix: string;
  /** Shown as clickable chips so a first-time visitor never faces an empty box. */
  examples: string[];
  /** Placeholder inside the prompt input. */
  placeholder: string;
  icon: string;
  keywords: string[];
};

export const PRESETS: Preset[] = [
  {
    slug: 'game-assets',
    name: 'Game assets',
    tagline: 'Sprites, item icons and concept art for your game.',
    prefix: 'game asset,',
    suffix: ', centered, plain background, clean silhouette, digital painting, high contrast',
    examples: [
      'a health potion bottle with glowing red liquid',
      'an iron sword with a leather-wrapped hilt',
      'a mossy stone treasure chest, closed',
      'a wizard staff topped with a blue crystal',
      'a cartoon slime enemy, green and glossy',
    ],
    placeholder: 'a health potion bottle with glowing red liquid',
    icon: '🎮',
    keywords: ['game asset generator', 'ai sprite generator', 'game art ai', 'indie game assets', 'item icons'],
  },
  {
    slug: 'wallpapers',
    name: 'Wallpapers',
    tagline: 'Desktop and phone backgrounds, generated in seconds.',
    prefix: '',
    suffix: ', wallpaper, cinematic lighting, highly detailed, atmospheric, wide vista',
    examples: [
      'a lone lighthouse on a cliff during a storm',
      'neon Tokyo alley in the rain at night',
      'snow-covered pine forest under aurora borealis',
      'a desert canyon at golden hour',
      'floating islands above a sea of clouds',
    ],
    placeholder: 'neon Tokyo alley in the rain at night',
    icon: '🖼',
    keywords: ['ai wallpaper generator', 'free wallpaper ai', 'desktop background generator', '4k wallpaper ai'],
  },
  {
    slug: 'fantasy-characters',
    name: 'Fantasy characters',
    tagline: 'D&D portraits, NPCs and party art.',
    prefix: 'character portrait of',
    suffix: ', fantasy art, detailed face, dramatic lighting, painterly, upper body',
    examples: [
      'a dwarven blacksmith with a braided beard',
      'an elven ranger with silver hair and green cloak',
      'a tiefling warlock holding a glowing tome',
      'a grizzled human paladin in dented plate armour',
      'a halfling rogue grinning, hood up',
    ],
    placeholder: 'an elven ranger with silver hair and green cloak',
    icon: '🐉',
    keywords: ['dnd character portrait ai', 'fantasy character generator', 'rpg npc art', 'd&d art generator'],
  },
  {
    slug: 'stickers',
    name: 'Stickers & emotes',
    tagline: 'Discord and Twitch art, bold and readable when small.',
    prefix: 'sticker of',
    suffix: ', bold outline, flat colors, simple shapes, centered, white background, cute',
    examples: [
      'a cat wearing headphones, thumbs up',
      'a happy coffee cup with big eyes',
      'a shocked pixel-art ghost',
      'a determined frog with a tiny sword',
      'a sleepy capybara in a hot spring',
    ],
    placeholder: 'a cat wearing headphones, thumbs up',
    icon: '✨',
    keywords: ['ai sticker generator', 'discord emote generator', 'twitch emote ai', 'free sticker maker'],
  },
];

/** The open generator on `/` — no styling applied, whatever the user types. */
export const FREEFORM: Preset = {
  slug: '',
  name: 'Anything',
  tagline: 'Describe whatever you want. No style applied.',
  prefix: '',
  suffix: '',
  examples: [
    'a cozy cabin in a snowy forest, warm light, cinematic',
    'a red fox sleeping on a mossy rock',
    'an astronaut floating above a coral reef',
    'a bowl of ramen, steam rising, food photography',
    'a vintage motorcycle parked outside a diner at dusk',
  ],
  placeholder: 'a cozy cabin in a snowy forest, warm light, cinematic',
  icon: '◇',
  keywords: ['ai image generator', 'free ai image generator no signup', 'text to image', 'unlimited ai images'],
};

export const getPreset = (slug: string): Preset =>
  PRESETS.find((p) => p.slug === slug) ?? FREEFORM;

/** Compose the final prompt sent to the text encoder. */
export function buildPrompt(preset: Preset, userPrompt: string): string {
  return [preset.prefix, userPrompt.trim(), preset.suffix]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
