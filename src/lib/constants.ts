export const SITE = {
  name: 'Vexyn',
  url: 'https://vexyn.app',
  title: 'Vexyn — Free Financial Data Tools That Run In Your Browser',
  description:
    'Free tools to clean, convert, reconcile and analyze financial data — bank exports, Stripe reports, CSVs. Everything runs in your browser. Your data is never uploaded.',
  // 'no upload', 'no signup', 'no tracking' are architectural promises we can
  // keep forever because processing is client-side. Never claim 'no ads' —
  // display ads are the funding model and must not become a broken promise.
  tagline: 'Financial data tools that never leave your device.',
  author: 'Vexyn',
  email: 'support.vexyn@gmail.com',
  github: 'https://github.com/andreicristi88/vexyn',
  twitter: '@vexynapp',
  keywords: [
    'csv cleaner',
    'bank statement analyzer',
    'stripe csv',
    'csv to excel',
    'transaction categorizer',
    'reconciliation tool',
    'financial data tools',
    'private finance tools',
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
      { label: 'Financial Data', href: '/#data', description: 'CSV clean, convert, dedupe, merge' },
      { label: 'Business Finance', href: '/#business', description: 'Stripe, reconciliation, revenue' },
      { label: 'Personal Finance', href: '/#personal', description: 'Bank statements, spending, subscriptions' },
      { label: 'All tools', href: '/#tools', description: 'The complete list' },
    ],
  },
  { label: 'Guides', href: '/blog' },
  { label: 'About', href: '/about' },
  { label: 'GitHub', href: 'https://github.com/andreicristi88/vexyn', external: true },
];
