import { SITE } from './constants';

export type Faq = { q: string; a: string };

/**
 * The public URL path for a page, from Astro.url.pathname.
 *
 * With `build.format: 'file'` every page is written as `<name>.html`, and
 * Astro.url.pathname carries that extension — so the raw value is
 * "/csv-cleaner.html" and, for the homepage, "/index.html". Cloudflare serves
 * those files at the extensionless path, which is what the sitemap and every
 * internal link use, so the raw pathname must never be published as-is: a
 * canonical of "/index.html" tells search engines the homepage lives at a URL
 * nothing else on the site points to.
 *
 * Anything deriving a URL or matching a route from the pathname goes through
 * here. It exists as one function because the same normalization was written
 * twice and only corrected in one of them.
 */
export function cleanPath(pathname: string): string {
  return (
    pathname
      .replace(/\.html$/, '')
      .replace(/\/index$/, '')
      .replace(/\/$/, '') || '/'
  );
}

export function breadcrumbSchema(items: Array<{ name: string; url?: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.url ? { item: new URL(it.url, SITE.url).toString() } : {}),
    })),
  };
}

export function faqSchema(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function webAppSchema(opts: {
  name: string;
  url: string;
  description: string;
  category?: string;
  features?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: opts.name,
    url: opts.url,
    description: opts.description,
    applicationCategory: opts.category ?? 'UtilitiesApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(opts.features ? { featureList: opts.features } : {}),
  };
}

export function itemListSchema(items: Array<{ name: string; url: string; description?: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: new URL(it.url, SITE.url).toString(),
      ...(it.description ? { description: it.description } : {}),
    })),
  };
}

/** Combine multiple JSON-LD blocks into a @graph for a single script tag. */
export function combineSchemas(...schemas: any[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': schemas.map(({ '@context': _ctx, ...rest }) => rest),
  };
}
