export const SITE = {
  name: 'Vexyn',
  url: 'https://vexyn.app',
  title: 'Vexyn — Browser Tools That Stay Local',
  description: 'Privacy-first browser tools. Everything runs on your device. No upload. No signup. No tracking.',
  // Note: 'no tracking', 'no upload', 'no signup' are architectural promises.
  // Avoid claiming 'no ads' anywhere — leaves room for non-tracking ad networks
  // (e.g. Carbon Ads) or sponsorships in the future without breaking trust.
  tagline: 'Tools that stay on your device.',
  author: 'Vexyn',
  email: 'support.vexyn@gmail.com',
  github: 'https://github.com/andreicristi88/vexyn',
  twitter: '@vexynapp',
  keywords: [
    'browser tools',
    'privacy tools',
    'local-first',
    'no upload',
    'free online tools',
    'developer tools',
    'PDF tools',
    'image tools',
  ],
};

export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
  children?: Array<{ label: string; href: string; description?: string }>;
};

export const NAV: NavItem[] = [
  {
    label: 'Tools',
    href: '/#tools',
    children: [
      { label: 'PDF Tools', href: '/pdf-tools', description: '13 tools — merge, split, compress, OCR, more' },
      { label: 'Image Tools', href: '/image-tools', description: '6 tools — compress, convert, BG remove, EXIF, palette' },
      { label: 'AI Tools', href: '/ai-tools', description: '3 tools — transcription, BG remove, OCR — all on-device' },
      { label: 'Developer Tools', href: '/developer-tools', description: '3 tools — JSON, Base64, QR' },
      { label: 'All tools', href: '/#tools', description: 'The complete list' },
    ],
  },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
  { label: 'GitHub', href: 'https://github.com/andreicristi88/vexyn', external: true },
];
