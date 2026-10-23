import type { Metadata } from 'next';
import type { Locale } from '@/components/landing-copy';
import { basePath, withBasePath } from '@/lib/base-path';

export const siteName = 'Mink';
export const repoUrl = 'https://github.com/yaroslavlky/mink';

// Set NEXT_PUBLIC_SITE_URL to the production origin before deploying.
// NEXT_PUBLIC_BASE_PATH covers project GitHub Pages, e.g. /mink.
export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mink.dev');

export function absoluteUrl(path = '/') {
  return `${siteUrl.origin}${withBasePath(path)}`;
}

export const defaultDescription =
  'Mink finds the scripts, Make targets, and shell files already in your repository, then runs them from one terminal palette with typed parameters, pipelines, and services.';

export const keywords = [
  'terminal command palette',
  'developer tools',
  'command runner',
  'task runner',
  'npm scripts',
  'make targets',
  'shell scripts',
  'pipelines',
  'local services',
  'CLI',
  'Mink',
];

export const ogImage = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Mink terminal command palette',
  type: 'image/png',
};

export const ogLocale: Record<Locale, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  de: 'de_DE',
  fr: 'fr_FR',
  zh: 'zh_CN',
};

export function siteMetadata(title: string, description: string): Metadata {
  return {
    metadataBase: new URL(`${siteUrl.origin}${basePath}/`),
    title: {
      default: title,
      template: '%s · Mink',
    },
    description,
    applicationName: siteName,
    keywords,
    authors: [{ name: 'Mink contributors', url: repoUrl }],
    creator: 'Mink',
    publisher: 'Mink',
    category: 'developer tools',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      url: absoluteUrl('/'),
      images: [ogImage],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage.url],
    },
  };
}
