import type { MetadataRoute } from 'next';
import { localeHref, locales } from '@/components/landing-copy';
import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-static';

const docsPages = [
  'overview',
  'quickstart',
  'cli',
  'configuration',
  'parameters',
  'discovery',
  'pipelines',
  'services',
  'state',
  'security',
  'architecture',
  'development',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const languages = Object.fromEntries(
    locales.map((code) => [code, new URL(localeHref[code], siteUrl).toString()]),
  );

  const landingPages = locales.map((code) => ({
    url: new URL(localeHref[code], siteUrl).toString(),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: code === 'en' ? 1 : 0.9,
    alternates: { languages },
  }));

  const docs = docsPages.map((slug) => ({
    url: new URL(`/${slug}/`, siteUrl).toString(),
    lastModified,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...landingPages, ...docs];
}
