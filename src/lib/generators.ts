/**
 * The whole site is data. Every generator page — its SEO, its hero, its prompt
 * styling and its Prompt Builder fields — is one object in GENERATORS below.
 * A dynamic route ([generator].astro) turns each into a page at build time, so
 * adding a generator means adding an object here, never a new file.
 *
 * HARD CONSTRAINT, do not forget: the model (SDXS) runs a single denoising step
 * with no classifier-free guidance. A negative prompt has literally no effect.
 * There is no `negative` field anywhere and there must never be one — steering
 * happens only through the positive prompt. Defect avoidance is baked into the
 * quality tokens in each suffix instead.
 */

export type CategoryId = 'games' | 'design' | 'anime' | 'fun' | 'art';

export type Category = {
  id: CategoryId;
  name: string;
  tagline: string;
  icon: string;
  /** Ordering on the home page. Games first — it is the model's strongest suit. */
  order: number;
};

export const CATEGORIES: Category[] = [
  { id: 'games', name: 'AI Games', tagline: 'Characters, items, monsters and worlds for your game.', icon: '🎮', order: 1 },
  { id: 'anime', name: 'AI Anime', tagline: 'Characters and scenes in anime and manga styles.', icon: '🌸', order: 2 },
  { id: 'art', name: 'AI Art', tagline: 'Fantasy, concept art and cinematic scenes.', icon: '🎨', order: 3 },
  { id: 'design', name: 'AI Design', tagline: 'Icons, stickers, wallpapers — with real transparent PNGs.', icon: '🖌', order: 4 },
  { id: 'fun', name: 'AI Fun', tagline: 'Robots, aliens, superheroes and other stylized characters.', icon: '🎉', order: 5 },
];

/** A Prompt Builder input. Its selected value is a natural phrase that reads
 *  correctly when comma-joined into the prompt (e.g. "wearing plate armor"). */
export type Field = {
  id: string;
  label: string;
  /** First option is the default. An empty value means "no preference". */
  options: { label: string; value: string }[];
};

export type Faq = { q: string; a: string };

export type Generator = {
  slug: string;
  category: CategoryId;
  name: string;
  h1: string;
  tagline: string;
  title: string;
  description: string;
  intro: string;
  icon: string;
  keywords: string[];
  /** Prepended before the user's subject. Keep tiny. */
  prefix: string;
  /** Appended after subject + fields. Style + quality tokens live here. */
  suffix: string;
  /** Optional structured inputs shown as the Prompt Builder. */
  fields?: Field[];
  /** Whether the describe box is the primary input (true) or fields are (false).
   *  When false, the describe box is optional and labelled "add detail". */
  describeIsPrimary: boolean;
  placeholder: string;
  examples: string[];
  /** Offer client-side background removal for a real transparent PNG. */
  transparent?: boolean;
  faqs: Faq[];
  /** Cross-links at the bottom of the page. */
  related: string[];
};

// ─── Shared field pools (reused across game/character generators) ──────────
const GENDER: Field = {
  id: 'gender', label: 'Gender',
  options: [
    { label: 'Any', value: '' },
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
  ],
};
const RACE: Field = {
  id: 'race', label: 'Race',
  options: [
    { label: 'Human', value: 'human' },
    { label: 'Elf', value: 'elf' },
    { label: 'Dwarf', value: 'dwarf' },
    { label: 'Orc', value: 'orc' },
    { label: 'Tiefling', value: 'tiefling' },
    { label: 'Dragonborn', value: 'dragonborn' },
    { label: 'Halfling', value: 'halfling' },
    { label: 'Undead', value: 'undead' },
  ],
};
const ARMOR: Field = {
  id: 'armor', label: 'Armor',
  options: [
    { label: 'Plate', value: 'wearing heavy plate armor' },
    { label: 'Leather', value: 'wearing worn leather armor' },
    { label: 'Robes', value: 'wearing arcane robes' },
    { label: 'Chainmail', value: 'wearing chainmail' },
    { label: 'Cloak', value: 'wearing a hooded cloak' },
    { label: 'None', value: '' },
  ],
};
const WEAPON: Field = {
  id: 'weapon', label: 'Weapon',
  options: [
    { label: 'Sword', value: 'holding a sword' },
    { label: 'Greatsword', value: 'holding a massive greatsword' },
    { label: 'Bow', value: 'holding a longbow' },
    { label: 'Staff', value: 'holding a glowing staff' },
    { label: 'Daggers', value: 'holding twin daggers' },
    { label: 'Axe', value: 'holding a battle axe' },
    { label: 'None', value: '' },
  ],
};
const POSE: Field = {
  id: 'pose', label: 'Pose',
  options: [
    { label: 'Standing', value: 'standing confidently' },
    { label: 'Action', value: 'dynamic action pose' },
    { label: 'Battle stance', value: 'ready battle stance' },
    { label: 'Portrait', value: 'calm portrait pose' },
  ],
};
const BACKDROP: Field = {
  id: 'backdrop', label: 'Background',
  options: [
    { label: 'Plain', value: 'plain studio background' },
    { label: 'Castle', value: 'castle background' },
    { label: 'Forest', value: 'dark forest background' },
    { label: 'Dungeon', value: 'torchlit dungeon background' },
    { label: 'Battlefield', value: 'smoky battlefield background' },
    { label: 'Snowy peak', value: 'snowy mountain background' },
  ],
};
const ART_STYLE: Field = {
  id: 'style', label: 'Style',
  options: [
    { label: 'Realistic', value: 'realistic rendering' },
    { label: 'Painterly', value: 'painterly digital art' },
    { label: 'Stylized', value: 'stylized cartoon art' },
    { label: 'Dark', value: 'dark gritty art' },
    { label: 'Anime', value: 'anime art style' },
  ],
};

const Q_CHAR = 'game character, concept art, highly detailed, sharp focus, professional';
const Q_ITEM = 'game asset, centered, clean silhouette, high contrast, digital painting, sharp focus';

// ─── Generators ────────────────────────────────────────────────────────────
export const GENERATORS: Generator[] = [
  // ═══ GAMES (priority) ═══
  {
    slug: 'game-image-generator',
    category: 'games', name: 'Game images', icon: '🎮',
    h1: 'AI Game Image Generator',
    tagline: 'Any game art you can describe — free and unlimited.',
    title: 'AI Game Image Generator — Free, No Signup, Unlimited',
    description: 'Generate game art with AI: concept art, key art, splash images. Free and unlimited, runs on your own GPU — no credits, no queue.',
    intro: 'Describe any game art and get it in seconds. Digital-game styling is applied automatically — concept-art quality, sharp and detailed.',
    keywords: ['game image generator', 'ai game art', 'concept art generator', 'game art ai', 'indie game art'],
    prefix: '', suffix: `, digital game art, ${Q_CHAR}`,
    describeIsPrimary: true,
    placeholder: 'a ruined temple overgrown with glowing vines',
    examples: [
      'a ruined temple overgrown with glowing vines',
      'a floating airship above stormy clouds',
      'a neon cyberpunk street market at night',
      'a lone knight before a giant stone door',
      'a magical forest clearing with fireflies',
    ],
    faqs: [
      { q: 'Can I use these in a commercial game?', a: 'Yes. The model licence (OpenRAIL++) permits commercial use of outputs — ship them in your Steam release, jam entry or mobile game.' },
      { q: 'How do I keep a consistent style?', a: 'Lock the seed and keep your prompt structure identical, changing only the subject. Rerolls are free, so explore as much as you want.' },
      { q: 'What resolution are the images?', a: '512×512 natively — the size a model small enough to run in your browser produces in one step. Upscale afterwards for higher resolution.' },
    ],
    related: ['game-character-generator', 'environment-generator', 'weapon-generator'],
  },
  {
    slug: 'game-character-generator',
    category: 'games', name: 'Game characters', icon: '🧙',
    h1: 'AI Game Character Generator',
    tagline: 'Build a character from parts — race, armor, weapon, pose.',
    title: 'AI Game Character Generator — Free Character Creator',
    description: 'Create game characters with AI. Pick race, gender, armor, weapon and pose — get concept art in seconds. Free, unlimited, no signup.',
    intro: 'Build a character piece by piece and let the model draw it. Fill in what you want, leave the rest — every combination is free to try.',
    keywords: ['game character generator', 'ai character creator', 'character concept art', 'rpg character generator'],
    prefix: 'full body character,', suffix: `, ${Q_CHAR}, centered`,
    fields: [RACE, GENDER, ARMOR, WEAPON, POSE, BACKDROP],
    describeIsPrimary: false,
    placeholder: 'add detail — e.g. glowing blue eyes, long white hair',
    examples: ['scarred veteran with an eyepatch', 'young mage with freckles', 'towering brute with tusks'],
    faqs: [
      { q: 'How do I get the same character again?', a: 'Lock the seed and keep the fields identical. Small changes with a locked seed give variations of the same character.' },
      { q: 'Can it do full body and face detail?', a: 'It renders full-body concept art. For a close portrait, use the Fantasy Character generator, which frames the upper body.' },
      { q: 'Do I have to fill every field?', a: 'No. Leave any field on "Any" or "None" and describe the rest in the detail box, or leave it blank entirely.' },
    ],
    related: ['fantasy-character-generator', 'rpg-character-generator', 'npc-generator'],
  },
  {
    slug: 'fantasy-character-generator',
    category: 'games', name: 'Fantasy characters', icon: '🐉',
    h1: 'AI Fantasy Character Generator',
    tagline: 'D&D portraits, NPCs and party art.',
    title: 'AI Fantasy Character Generator — Free D&D Portraits',
    description: 'Generate fantasy character portraits for D&D, Pathfinder and any TTRPG. Free, unlimited, no signup — runs in your browser.',
    intro: 'Your character, visualised. Describe race, class and one memorable detail — epic fantasy styling with cinematic lighting is applied automatically.',
    keywords: ['fantasy character generator', 'dnd character portrait ai', 'd&d art generator', 'rpg npc art'],
    prefix: 'character portrait of', suffix: ', fantasy, magic, epic, cinematic lighting, detailed face, painterly, upper body, concept art',
    describeIsPrimary: true,
    placeholder: 'an elven ranger with silver hair and green cloak',
    examples: [
      'a dwarven blacksmith with a braided beard',
      'an elven ranger with silver hair and green cloak',
      'a tiefling warlock holding a glowing tome',
      'a grizzled human paladin in dented plate armour',
      'a halfling rogue grinning, hood up',
    ],
    faqs: [
      { q: 'Can I use a portrait for my character sheet or stream?', a: 'Yes — commercial use of outputs is permitted. Character sheets, VTT tokens, Twitch overlays: all fine.' },
      { q: 'The face looks odd — what do I do?', a: 'Reroll; seeds vary a lot on faces. Specifying age, expression and one distinctive feature helps the model commit.' },
      { q: 'Does it know D&D races?', a: 'Tieflings, dragonborn, drow, paladins and warlocks all render recognisably. Homebrew concepts work best described physically.' },
    ],
    related: ['game-character-generator', 'rpg-character-generator', 'monster-generator'],
  },
  {
    slug: 'rpg-character-generator',
    category: 'games', name: 'RPG characters', icon: '⚔️',
    h1: 'AI RPG Character Generator',
    tagline: 'Full-body inventory art for your RPG.',
    title: 'AI RPG Character Generator — Free Full-Body Character Art',
    description: 'Generate full-body RPG character art with AI — inventory-screen style, high detail. Free and unlimited, runs on your device.',
    intro: 'Full-body character art in the classic RPG inventory-screen style. Describe the hero, get clean high-detail art you can drop into a UI.',
    keywords: ['rpg character generator', 'full body character art', 'inventory art ai', 'rpg portrait generator'],
    prefix: 'full body', suffix: ', RPG character, inventory art, standing, fantasy, high detail, concept art, centered, plain background',
    describeIsPrimary: true,
    placeholder: 'a battle-worn ranger with a wolf pelt cloak',
    examples: ['a battle-worn ranger with a wolf pelt cloak', 'a robed necromancer with a skull staff', 'a cheerful bard with a lute'],
    faqs: [
      { q: 'Why full body instead of a portrait?', a: 'This one is tuned for the standing full-body art RPGs use on inventory and character screens. For faces, use the Fantasy Character generator.' },
      { q: 'Can I get a transparent cutout?', a: 'Generate here, then use the Sticker generator or any background remover — the plain background this produces cuts cleanly.' },
    ],
    related: ['game-character-generator', 'fantasy-character-generator', 'npc-generator'],
  },
  {
    slug: 'game-icon-generator',
    category: 'games', name: 'Game icons', icon: '🔷',
    h1: 'AI Game Icon Generator',
    tagline: 'Skill icons, item icons, ability icons.',
    title: 'AI Game Icon Generator — Free Skill & Item Icons',
    description: 'Generate game icons with AI — skills, items, abilities. Centered, high-contrast, ready for a UI. Free, unlimited, transparent PNG.',
    intro: 'Clean, centered icons for skills, items and abilities. High contrast so they read at small sizes — and you can export a transparent PNG.',
    keywords: ['game icon generator', 'skill icon ai', 'ability icon generator', 'item icon ai'],
    prefix: 'game icon of', suffix: `, ${Q_ITEM}, simple composition, plain background`,
    describeIsPrimary: true,
    placeholder: 'a glowing fireball spell',
    examples: ['a glowing fireball spell', 'a golden shield with a lion crest', 'a green poison vial', 'a lightning bolt rune'],
    transparent: true,
    faqs: [
      { q: 'Can I get a transparent background?', a: 'Yes — hit "Remove background" on any result. A small model runs in your browser to cut a real transparent PNG. No upload.' },
      { q: 'Will icons read at small sizes?', a: 'The styling forces high contrast and simple composition for exactly that. Describe one clear object, not a busy scene.' },
    ],
    related: ['weapon-generator', 'game-image-generator', 'app-icon-generator'],
  },
  {
    slug: 'weapon-generator',
    category: 'games', name: 'Weapons', icon: '🗡',
    h1: 'AI Weapon Generator',
    tagline: 'Swords, staves, bows — inventory-ready.',
    title: 'AI Weapon Generator — Free Game Weapon Icons',
    description: 'Generate fantasy weapons with AI — swords, staves, bows, axes. Inventory-icon style, high detail. Free, unlimited, transparent PNG.',
    intro: 'Fantasy weapons as clean inventory icons. High detail, centered, plain background — and one click for a transparent PNG.',
    keywords: ['weapon generator', 'fantasy weapon ai', 'game weapon icon', 'sword generator ai'],
    prefix: '', suffix: `, game weapon, inventory icon, fantasy, ${Q_ITEM}, plain background`,
    describeIsPrimary: true,
    placeholder: 'a flaming greatsword with a dragonbone hilt',
    examples: ['a flaming greatsword with a dragonbone hilt', 'an elven longbow carved with runes', 'a crystal-tipped mage staff', 'a rusty pirate cutlass'],
    transparent: true,
    faqs: [
      { q: 'Transparent background?', a: 'Yes — "Remove background" runs a small model in your browser and gives a real transparent PNG. Nothing is uploaded.' },
      { q: 'Can I make a matching weapon set?', a: 'Lock the seed and vary only the weapon type in your prompt for a consistent set.' },
    ],
    related: ['game-icon-generator', 'game-image-generator', 'monster-generator'],
  },
  {
    slug: 'monster-generator',
    category: 'games', name: 'Monsters', icon: '👹',
    h1: 'AI Monster Generator',
    tagline: 'Creatures, bosses and beasts.',
    title: 'AI Monster Generator — Free Fantasy Creature Art',
    description: 'Generate fantasy monsters and creatures with AI — bosses, beasts, enemies. Epic concept art. Free, unlimited, no signup.',
    intro: 'Creatures for your game — from goblins to god-tier bosses. Epic creature-concept styling is applied automatically.',
    keywords: ['monster generator', 'ai creature generator', 'fantasy monster ai', 'boss concept art'],
    prefix: '', suffix: ', fantasy monster, epic, game creature, concept art, highly detailed, dramatic lighting',
    describeIsPrimary: true,
    placeholder: 'a six-eyed cave spider dripping venom',
    examples: ['a six-eyed cave spider dripping venom', 'a molten lava golem', 'a spectral wraith with chains', 'a towering forest troll'],
    faqs: [
      { q: 'Can it do a big boss creature?', a: 'Yes — words like "colossal", "towering" and "boss" push scale. Add the environment for atmosphere.' },
      { q: 'Commercial use?', a: 'Permitted by the model licence. Use them as enemies, bosses or bestiary art in your game.' },
    ],
    related: ['npc-generator', 'game-character-generator', 'environment-generator'],
  },
  {
    slug: 'npc-generator',
    category: 'games', name: 'NPCs', icon: '🧑‍🌾',
    h1: 'AI NPC Generator',
    tagline: 'Villagers, merchants, quest-givers.',
    title: 'AI NPC Generator — Free Game NPC Art',
    description: 'Generate NPC art with AI — villagers, merchants, quest-givers. Full-body game art. Free, unlimited, populate a whole town in an evening.',
    intro: 'Populate your world. Describe a townsperson, merchant or quest-giver and get consistent full-body game art — a whole village in one sitting.',
    keywords: ['npc generator', 'ai npc art', 'game character generator', 'quest giver art'],
    prefix: '', suffix: `, NPC, full body, standing, ${Q_CHAR}`,
    describeIsPrimary: true,
    placeholder: 'a friendly baker with flour on her apron',
    examples: ['a friendly baker with flour on her apron', 'a shifty hooded merchant', 'an old fisherman with a pipe', 'a stern town guard'],
    faqs: [
      { q: 'Can I keep NPCs looking like one world?', a: 'Give them a shared palette or era in each prompt ("medieval", "muted colors") so the set reads as one game.' },
      { q: 'Full body or portrait?', a: 'Full body standing, ready for a dialogue screen. For close faces, use the Fantasy Character generator.' },
    ],
    related: ['game-character-generator', 'monster-generator', 'fantasy-character-generator'],
  },
  {
    slug: 'environment-generator',
    category: 'games', name: 'Environments', icon: '🏞',
    h1: 'AI Environment Generator',
    tagline: 'Landscapes, levels and backdrops.',
    title: 'AI Environment Generator — Free Game Backgrounds',
    description: 'Generate game environments with AI — landscapes, levels, backdrops. Cinematic concept art. Free, unlimited, runs in your browser.',
    intro: 'Worlds and backdrops for your game. Describe a place and get cinematic environment concept art — level references, splash backgrounds, mood shots.',
    keywords: ['environment generator', 'game background ai', 'landscape concept art', 'level art generator'],
    prefix: '', suffix: ', fantasy landscape, game environment, concept art, cinematic, wide vista, highly detailed, atmospheric',
    describeIsPrimary: true,
    placeholder: 'a misty swamp with ancient ruins',
    examples: ['a misty swamp with ancient ruins', 'a golden desert with a buried city', 'a frozen mountain pass at dawn', 'a lava cavern with glowing rivers'],
    faqs: [
      { q: 'Can I use these as level backgrounds?', a: 'Yes — as references, parallax backdrops or splash art. Upscale for higher resolution.' },
      { q: 'Landscape orientation?', a: 'Output is square 512×512; "wide vista" is baked in for a panoramic feel. Crop to your aspect ratio.' },
    ],
    related: ['game-image-generator', 'monster-generator', 'wallpaper-generator'],
  },
  {
    slug: 'pixel-art-generator',
    category: 'games', name: 'Pixel art', icon: '👾',
    h1: 'AI Pixel Art Generator',
    tagline: '8-bit sprites and retro game art.',
    title: 'AI Pixel Art Generator — Free 8-Bit Sprite Maker',
    description: 'Generate pixel art with AI — 8-bit sprites, retro game art, clean edges. Free, unlimited, no signup. Runs on your device.',
    intro: 'Retro sprites and 8-bit art. Describe a character or item and get clean pixel-style art — use it as a reference or a starting point.',
    keywords: ['pixel art generator', 'ai sprite generator', '8-bit art ai', 'retro game art generator'],
    prefix: 'pixel art of', suffix: ', 8-bit, game sprite, clean edges, centered, retro, plain background',
    describeIsPrimary: true,
    placeholder: 'a little green slime with eyes',
    examples: ['a little green slime with eyes', 'a knight in blue armor', 'a treasure chest', 'a red mushroom'],
    transparent: true,
    faqs: [
      { q: 'Is this true pixel-perfect art?', a: 'It produces pixel-styled art, not a strict grid. For pixel-perfect sprites, use the output as a reference and redraw at target resolution.' },
      { q: 'Transparent sprite?', a: 'Yes — "Remove background" gives a transparent PNG you can drop into a tilemap.' },
    ],
    related: ['game-icon-generator', 'game-character-generator', 'weapon-generator'],
  },

  // ═══ ANIME ═══
  {
    slug: 'anime-character-generator',
    category: 'anime', name: 'Anime characters', icon: '🌸',
    h1: 'AI Anime Character Generator',
    tagline: 'Original anime and manga characters.',
    title: 'AI Anime Character Generator — Free, No Signup',
    description: 'Generate anime characters with AI — original designs, manga style. Free and unlimited, runs on your own device. No account.',
    intro: 'Original anime characters from a description. Anime styling is applied automatically — clean lines, expressive faces, vibrant color.',
    keywords: ['anime character generator', 'ai anime generator', 'anime art ai', 'manga character generator'],
    prefix: 'anime character,', suffix: ', anime art style, clean lines, vibrant colors, detailed, key visual',
    fields: [GENDER],
    describeIsPrimary: true,
    placeholder: 'a cheerful girl with pink twin tails and a school uniform',
    examples: [
      'a cheerful girl with pink twin tails and a school uniform',
      'a cool swordsman with a scar and black coat',
      'a shy witch with a big hat and green eyes',
      'a fox-spirit girl with white hair',
    ],
    faqs: [
      { q: 'What anime style does it use?', a: 'A general modern anime look. Add references like "90s anime", "chibi" or "shonen" to steer it.' },
      { q: 'Commercial use?', a: 'Outputs are yours under the model licence. Avoid recreating copyrighted characters.' },
    ],
    related: ['anime-landscape-generator', 'anime-wallpaper-generator', 'fantasy-character-generator'],
  },
  {
    slug: 'anime-landscape-generator',
    category: 'anime', name: 'Anime landscapes', icon: '⛩',
    h1: 'AI Anime Landscape Generator',
    tagline: 'Makoto-Shinkai-style scenery.',
    title: 'AI Anime Landscape Generator — Free Anime Scenery',
    description: 'Generate anime landscapes with AI — lush skies, detailed scenery, that cinematic anime-film look. Free, unlimited, no signup.',
    intro: 'Scenery in the lush, cinematic anime-film style — dramatic skies, glowing light, painterly detail.',
    keywords: ['anime landscape generator', 'anime scenery ai', 'anime background generator', 'anime wallpaper ai'],
    prefix: '', suffix: ', anime landscape, cinematic anime film style, lush detailed sky, beautiful lighting, key visual',
    describeIsPrimary: true,
    placeholder: 'a train platform under a pink sunset sky',
    examples: ['a train platform under a pink sunset sky', 'a quiet shrine among cherry blossoms', 'a rooftop under a starry night', 'a rainy Tokyo street with reflections'],
    faqs: [
      { q: 'Can I use these as wallpapers?', a: 'Yes — see the Anime Wallpaper generator, tuned for phone and desktop framing.' },
    ],
    related: ['anime-wallpaper-generator', 'anime-character-generator', 'wallpaper-generator'],
  },
  {
    slug: 'anime-wallpaper-generator',
    category: 'anime', name: 'Anime wallpapers', icon: '📱',
    h1: 'AI Anime Wallpaper Generator',
    tagline: 'Phone and desktop anime backgrounds.',
    title: 'AI Anime Wallpaper Generator — Free & Unlimited',
    description: 'Generate anime wallpapers with AI for phone and desktop. Free, unlimited, no watermark. Runs on your own device.',
    intro: 'Anime wallpapers nobody else has. Describe the vibe, reroll for free, no watermark.',
    keywords: ['anime wallpaper generator', 'anime wallpaper ai', 'free anime background', 'anime phone wallpaper'],
    prefix: '', suffix: ', anime wallpaper, cinematic anime style, beautiful lighting, highly detailed, atmospheric',
    describeIsPrimary: true,
    placeholder: 'a girl watching fireworks from a hill',
    examples: ['a girl watching fireworks from a hill', 'a cozy bedroom with city lights outside', 'a lone cat on a moonlit fence', 'a field of glowing flowers at dusk'],
    faqs: [
      { q: 'Resolution for my screen?', a: 'Native 512×512 — upscale it and crop to 16:9 for desktop or 9:19 for phone. Anime art upscales cleanly.' },
      { q: 'Watermark?', a: 'None. The image is drawn in your browser; what you generate is exactly what you download.' },
    ],
    related: ['anime-landscape-generator', 'wallpaper-generator', 'anime-character-generator'],
  },

  // ═══ ART ═══
  {
    slug: 'concept-art-generator',
    category: 'art', name: 'Concept art', icon: '🎨',
    h1: 'AI Concept Art Generator',
    tagline: 'Cinematic concept art for any idea.',
    title: 'AI Concept Art Generator — Free & Unlimited',
    description: 'Generate concept art with AI — characters, environments, props, moods. Cinematic and detailed. Free, unlimited, no signup.',
    intro: 'Professional-looking concept art from a sentence. Cinematic lighting and rich detail are applied automatically.',
    keywords: ['concept art generator', 'ai concept art', 'cinematic art generator', 'digital art ai'],
    prefix: '', suffix: ', concept art, cinematic lighting, highly detailed, professional, sharp focus, artstation',
    fields: [ART_STYLE],
    describeIsPrimary: true,
    placeholder: 'a lighthouse keeper facing a storm giant',
    examples: ['a lighthouse keeper facing a storm giant', 'a derelict spaceship interior', 'a market on the back of a giant beast', 'a knight kneeling in a cathedral of light'],
    faqs: [
      { q: 'What is concept art good for?', a: 'Mood boards, pitch decks, references for artists, story beats — anywhere you need to see an idea fast.' },
    ],
    related: ['fantasy-character-generator', 'environment-generator', 'game-image-generator'],
  },
  {
    slug: 'wallpaper-generator',
    category: 'art', name: 'Wallpapers', icon: '🖼',
    h1: 'AI Wallpaper Generator',
    tagline: 'Desktop and phone backgrounds.',
    title: 'AI Wallpaper Generator — Free, Unlimited, No Account',
    description: 'Generate desktop and phone wallpapers with AI, free and unlimited. Runs on your GPU — no signup, no watermark, no queue.',
    intro: 'Describe the scene you want on your screen. Cinematic styling — atmospheric lighting, rich detail, wide vistas — is applied automatically.',
    keywords: ['ai wallpaper generator', 'free wallpaper ai', 'desktop background generator', '4k wallpaper ai'],
    prefix: '', suffix: ', wallpaper, cinematic lighting, highly detailed, atmospheric, wide vista, beautiful',
    describeIsPrimary: true,
    placeholder: 'neon Tokyo alley in the rain at night',
    examples: [
      'a lone lighthouse on a cliff during a storm',
      'neon Tokyo alley in the rain at night',
      'snow-covered pine forest under aurora borealis',
      'a desert canyon at golden hour',
      'floating islands above a sea of clouds',
    ],
    faqs: [
      { q: 'High enough resolution for my screen?', a: 'Native 512×512 — upscale to 1080p/4K with any free upscaler. Scenery upscales especially well.' },
      { q: 'Watermark?', a: 'None. The image is drawn in your own browser.' },
    ],
    related: ['environment-generator', 'anime-wallpaper-generator', 'concept-art-generator'],
  },

  // ═══ DESIGN (transparent) ═══
  {
    slug: 'sticker-generator',
    category: 'design', name: 'Stickers & emotes', icon: '✨',
    h1: 'AI Sticker & Emote Generator',
    tagline: 'Discord stickers and Twitch emotes, transparent.',
    title: 'AI Sticker & Emote Generator — Free, Transparent PNG',
    description: 'Make Discord stickers and Twitch emotes with AI. Bold outlines, real transparent PNG, readable when small. Free, unlimited.',
    intro: 'Bold, cute, readable-when-tiny. Describe a character and an emotion — sticker styling is applied, and you can export a real transparent PNG.',
    keywords: ['ai sticker generator', 'discord emote generator', 'twitch emote ai', 'transparent sticker maker'],
    prefix: 'sticker of', suffix: ', bold outline, flat colors, simple shapes, centered, cute, plain background',
    describeIsPrimary: true,
    placeholder: 'a cat wearing headphones, thumbs up',
    examples: [
      'a cat wearing headphones, thumbs up',
      'a happy coffee cup with big eyes',
      'a shocked pixel-art ghost',
      'a determined frog with a tiny sword',
      'a sleepy capybara in a hot spring',
    ],
    transparent: true,
    faqs: [
      { q: 'Do I get a real transparent PNG?', a: 'Yes — hit "Remove background". A small model runs in your browser to cut the background out. Nothing is uploaded. Then resize for Discord (320px) or Twitch (112/56/28px).' },
      { q: 'Will it read at 28 pixels?', a: 'The bold-outline styling is built for exactly that. One subject, one emotion, no clutter.' },
    ],
    related: ['app-icon-generator', 'game-icon-generator', 'cartoon-generator'],
  },
  {
    slug: 'app-icon-generator',
    category: 'design', name: 'App icons', icon: '📲',
    h1: 'AI App Icon Generator',
    tagline: 'Modern, flat mobile app icons.',
    title: 'AI App Icon Generator — Free, Transparent PNG',
    description: 'Generate mobile app icons with AI — flat, modern, gradient. Real transparent PNG. Free, unlimited, no signup.',
    intro: 'Clean, modern app icons. Flat shapes, tasteful gradients, centered — and one click for a transparent PNG.',
    keywords: ['app icon generator', 'ai app icon', 'mobile icon generator', 'icon maker ai'],
    prefix: 'mobile app icon,', suffix: ', flat, modern, gradient, centered, simple, plain background',
    describeIsPrimary: true,
    placeholder: 'a weather app with a sun and cloud',
    examples: ['a weather app with a sun and cloud', 'a meditation app with a lotus', 'a running app with a shoe', 'a notes app with a pencil'],
    transparent: true,
    faqs: [
      { q: 'Transparent or rounded-square?', a: 'Generate on a plain background, then "Remove background" for a transparent PNG. Add your own rounded-square frame in any editor.' },
      { q: 'Can I ship it in a real app?', a: 'Yes — commercial use is permitted. Avoid imitating existing brands.' },
    ],
    related: ['sticker-generator', 'game-icon-generator', 'logo-generator'],
  },
  {
    slug: 'logo-generator',
    category: 'design', name: 'Logos', icon: '🔺',
    h1: 'AI Logo Generator',
    tagline: 'Simple symbol logos — no text.',
    title: 'AI Logo Generator — Free Simple Symbol Logos',
    description: 'Generate simple symbol logos with AI — minimal, vector-like marks. Free, unlimited, transparent PNG. Best for icon marks, not text.',
    intro: 'Minimal symbol marks for a brand. Describe the idea as a shape — the model is great at symbols, not lettering, so keep text out of it.',
    keywords: ['logo generator', 'ai logo maker', 'symbol logo ai', 'minimal logo generator'],
    prefix: 'minimal logo symbol of', suffix: ', vector style, simple, flat, geometric, centered, plain background',
    describeIsPrimary: true,
    placeholder: 'a mountain inside a circle',
    examples: ['a mountain inside a circle', 'an origami fox', 'a leaf and a droplet', 'a geometric wolf head'],
    transparent: true,
    faqs: [
      { q: 'Why no text in the logo?', a: 'Diffusion models render text poorly — it comes out garbled. This generates the symbol; add your brand name yourself in a design tool.' },
      { q: 'Transparent PNG?', a: 'Yes — "Remove background" gives a clean transparent mark.' },
    ],
    related: ['app-icon-generator', 'sticker-generator', 'game-icon-generator'],
  },

  // ═══ FUN ═══
  {
    slug: 'robot-generator',
    category: 'fun', name: 'Robots', icon: '🤖',
    h1: 'AI Robot Generator',
    tagline: 'Mechs, droids and androids.',
    title: 'AI Robot Generator — Free Mech & Droid Art',
    description: 'Generate robots with AI — mechs, droids, androids. Detailed concept art. Free, unlimited, runs on your device.',
    intro: 'Robots of every kind — friendly droids to war mechs. Detailed sci-fi concept styling is applied automatically.',
    keywords: ['robot generator', 'ai mech generator', 'droid art ai', 'sci-fi robot generator'],
    prefix: '', suffix: ', robot, mech, sci-fi, concept art, highly detailed, dramatic lighting',
    describeIsPrimary: true,
    placeholder: 'a rusty scavenger droid with one glowing eye',
    examples: ['a rusty scavenger droid with one glowing eye', 'a sleek white medical android', 'a hulking battle mech', 'a tiny round helper robot'],
    faqs: [{ q: 'Commercial use?', a: 'Yes, outputs are yours under the model licence.' }],
    related: ['alien-generator', 'superhero-generator', 'concept-art-generator'],
  },
  {
    slug: 'alien-generator',
    category: 'fun', name: 'Aliens', icon: '👽',
    h1: 'AI Alien Generator',
    tagline: 'Extraterrestrials and creatures from beyond.',
    title: 'AI Alien Generator — Free Extraterrestrial Art',
    description: 'Generate aliens with AI — creatures, species, extraterrestrials. Detailed sci-fi concept art. Free, unlimited, no signup.',
    intro: 'Life from other worlds. Describe an alien and get detailed sci-fi creature art.',
    keywords: ['alien generator', 'ai alien art', 'extraterrestrial generator', 'sci-fi creature ai'],
    prefix: '', suffix: ', alien creature, sci-fi, concept art, highly detailed, otherworldly',
    describeIsPrimary: true,
    placeholder: 'a translucent jellyfish-like alien with lights',
    examples: ['a translucent jellyfish-like alien with lights', 'a four-armed desert nomad alien', 'a crystalline insectoid being', 'a friendly big-eyed grey alien'],
    faqs: [{ q: 'Can it do a whole species?', a: 'Describe shared traits and reroll — a locked seed keeps them consistent.' }],
    related: ['robot-generator', 'monster-generator', 'superhero-generator'],
  },
  {
    slug: 'superhero-generator',
    category: 'fun', name: 'Superheroes', icon: '🦸',
    h1: 'AI Superhero Generator',
    tagline: 'Original heroes and villains.',
    title: 'AI Superhero Generator — Free Original Hero Art',
    description: 'Generate original superheroes with AI — costumes, powers, poses. Comic and cinematic styles. Free, unlimited, no signup.',
    intro: 'Design an original hero or villain. Describe the costume and power — dynamic comic styling is applied.',
    keywords: ['superhero generator', 'ai superhero creator', 'original hero art', 'comic character generator'],
    prefix: '', suffix: ', superhero, dynamic pose, comic concept art, dramatic lighting, highly detailed',
    fields: [GENDER],
    describeIsPrimary: true,
    placeholder: 'a hero in a green and gold suit controlling vines',
    examples: ['a hero in a green and gold suit controlling vines', 'a shadowy vigilante with a raven motif', 'a speedster in orange lightning', 'an armored ice villain'],
    faqs: [{ q: 'Can I use these?', a: 'Yes, for original characters. Avoid recreating trademarked heroes.' }],
    related: ['robot-generator', 'alien-generator', 'cartoon-generator'],
  },
  {
    slug: 'fantasy-animal-generator',
    category: 'fun', name: 'Fantasy animals', icon: '🦄',
    h1: 'AI Fantasy Animal Generator',
    tagline: 'Mythical beasts and magical creatures.',
    title: 'AI Fantasy Animal Generator — Free Mythical Creature Art',
    description: 'Generate fantasy animals with AI — mythical beasts, magical creatures, hybrids. Detailed and whimsical. Free, unlimited.',
    intro: 'Mythical beasts and magical animals. Describe a creature — real, hybrid or impossible — and get charming detailed art.',
    keywords: ['fantasy animal generator', 'mythical creature ai', 'magical animal generator', 'creature art ai'],
    prefix: '', suffix: ', fantasy animal, magical creature, detailed, whimsical, concept art, beautiful lighting',
    describeIsPrimary: true,
    placeholder: 'a fox with butterfly wings and glowing tail',
    examples: ['a fox with butterfly wings and glowing tail', 'a tiny dragon curled like a cat', 'a deer with crystal antlers', 'a lion made of autumn leaves'],
    faqs: [{ q: 'Great for kids stories?', a: 'Yes — describe it warm and whimsical for a storybook look.' }],
    related: ['monster-generator', 'cartoon-generator', 'concept-art-generator'],
  },
  {
    slug: 'cartoon-generator',
    category: 'fun', name: 'Cartoons', icon: '🎈',
    h1: 'AI Cartoon Generator',
    tagline: 'Playful cartoon characters and scenes.',
    title: 'AI Cartoon Generator — Free Cartoon Character Art',
    description: 'Generate cartoon characters and scenes with AI — bright, playful, animation-style. Free, unlimited, runs in your browser.',
    intro: 'Bright, playful cartoon art. Describe a character or scene and get clean animation-style results.',
    keywords: ['cartoon generator', 'ai cartoon creator', 'cartoon character generator', 'animation style ai'],
    prefix: '', suffix: ', cartoon, animation style, bright colors, clean shapes, playful, character design',
    describeIsPrimary: true,
    placeholder: 'a chubby orange cat chef flipping a pancake',
    examples: ['a chubby orange cat chef flipping a pancake', 'a smiling cloud with sunglasses', 'a robot dog on a skateboard', 'a grumpy cactus in a pot'],
    transparent: true,
    faqs: [{ q: 'Transparent cutout?', a: 'Yes — "Remove background" gives a transparent PNG for stickers or overlays.' }],
    related: ['sticker-generator', 'fantasy-animal-generator', 'superhero-generator'],
  },
];

// ─── Lookups & prompt assembly ─────────────────────────────────────────────
export const getGenerator = (slug: string): Generator | undefined =>
  GENERATORS.find((g) => g.slug === slug);

export const generatorsIn = (cat: CategoryId): Generator[] =>
  GENERATORS.filter((g) => g.category === cat);

export const getCategory = (id: CategoryId): Category =>
  CATEGORIES.find((c) => c.id === id)!;

/** The open generator on `/` — no styling, whatever the user types. */
export const FREEFORM = {
  slug: '',
  name: 'Anything',
  h1: 'AI Image Generator',
  icon: '◇',
  prefix: '',
  suffix: '',
  fields: undefined as Field[] | undefined,
  describeIsPrimary: true,
  transparent: false,
  placeholder: 'a cozy cabin in a snowy forest, warm light, cinematic',
  examples: [
    'a cozy cabin in a snowy forest, warm light, cinematic',
    'a red fox sleeping on a mossy rock',
    'an astronaut floating above a coral reef',
    'a bowl of ramen, steam rising, food photography',
    'a vintage motorcycle parked outside a diner at dusk',
  ],
};

/** Shape shared by real generators and FREEFORM, enough to drive the component. */
export type PromptSource = Pick<
  Generator,
  'prefix' | 'suffix' | 'fields' | 'describeIsPrimary' | 'placeholder' | 'examples' | 'transparent' | 'icon' | 'slug'
>;

/**
 * Compose the final prompt. The user's own words go FIRST (after any tiny
 * prefix) because CLIP truncates at 77 tokens — the subject must survive even
 * if the trailing style tokens get cut.
 */
export function buildPrompt(
  src: PromptSource,
  describe: string,
  fieldValues: Record<string, string> = {},
): string {
  const fieldTokens = (src.fields ?? [])
    .map((f) => fieldValues[f.id])
    .filter((v): v is string => !!v && v.length > 0);

  // Comma is the token separator throughout. Joining then splitting on it
  // normalises everything at once: a prefix's own trailing comma, an empty
  // describe box, and unselected fields all collapse away cleanly, with no
  // stray double commas or leading commas to clean up afterwards.
  return [src.prefix, describe.trim(), ...fieldTokens, src.suffix]
    .join(',')
    .split(',')
    .map((s) => s.trim().replace(/\s{2,}/g, ' '))
    .filter(Boolean)
    .join(', ');
}
