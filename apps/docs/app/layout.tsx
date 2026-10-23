import type { Metadata, Viewport } from 'next';
import { Head } from 'nextra/components';
import 'nextra-theme-docs/style.css';
import { absoluteUrl, defaultDescription, siteMetadata } from '@/lib/seo';
import './style.css';

export const metadata: Metadata = {
  ...siteMetadata('Mink: terminal command palette', defaultDescription),
  icons: { icon: '/logo.png' },
};

export const viewport: Viewport = {
  themeColor: '#080808',
  colorScheme: 'dark',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Mink',
  url: absoluteUrl('/'),
  description: defaultDescription,
  inLanguage: ['en', 'ru', 'de', 'fr', 'zh'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className="dark" suppressHydrationWarning>
      <Head
        color={{ hue: 0, saturation: 0, lightness: { dark: 100, light: 10 } }}
        backgroundColor={{ dark: 'rgb(8,8,8)', light: 'rgb(250,250,250)' }}
      />
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
