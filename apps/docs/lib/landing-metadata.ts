import type { Metadata } from 'next';
import { landingCopy, localeHref, locales, type Locale } from '@/components/landing-copy';
import { absoluteUrl, ogImage, ogLocale, siteName } from '@/lib/seo';

export function landingMetadata(locale: Locale): Metadata {
  const copy = landingCopy[locale];
  return {
    title: { absolute: copy.meta.title },
    description: copy.meta.description,
    alternates: {
      canonical: absoluteUrl(localeHref[locale]),
      languages: {
        'x-default': absoluteUrl(localeHref.en),
        ...Object.fromEntries(locales.map((code) => [code, absoluteUrl(localeHref[code])])),
      },
    },
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
      title: copy.meta.title,
      description: copy.meta.description,
      url: absoluteUrl(localeHref[locale]),
      locale: ogLocale[locale],
      alternateLocale: locales.filter((code) => code !== locale).map((code) => ogLocale[code]),
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.meta.title,
      description: copy.meta.description,
      images: [ogImage.url],
    },
  };
}
