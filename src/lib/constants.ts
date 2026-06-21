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
  email: 'hello@vexyn.app',
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

export const NAV = [
  { label: 'Tools', href: '/#tools', external: false },
  { label: 'About', href: '/about', external: false },
  { label: 'GitHub', href: 'https://github.com/andreicristi88/vexyn', external: true },
];
