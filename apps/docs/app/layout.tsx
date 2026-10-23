import type { Metadata } from 'next';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';
import './style.css';
export const metadata: Metadata = {
  title: { default: 'Mink — repository control center', template: '%s · Mink' },
  description: 'Find, configure and run project commands from one terminal palette.',
  icons: { icon: '/logo.png' },
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head color={{ hue: 165, saturation: 70 }} />
      <body>
        <Layout
          navbar={
            <Navbar
              logo={
                <span className="mink-brand">
                  <img src="/logo.png" alt="" width="32" height="32" />
                  mink<span className="mink-alpha">alpha 0.1</span>
                </span>
              }
              projectLink="https://github.com/yaroslavlky/mink"
            />
          }
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/yaroslavlky/mink/tree/main/apps/docs/content"
          editLink="Edit this page on GitHub"
          footer={<Footer>MIT · Mink · A calmer way to run your repository.</Footer>}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
