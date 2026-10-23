import type { MetadataRoute } from 'next';
import { absoluteUrl, siteUrl } from '@/lib/seo';
import { withBasePath } from '@/lib/base-path';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [withBasePath('/og-card/')],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl.origin,
  };
}
