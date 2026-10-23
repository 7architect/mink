import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { getPageMap } from 'nextra/page-map';
import { withBasePath } from '@/lib/base-path';

const landingRoutes = new Set(['/', '/ru', '/de', '/fr', '/zh']);

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const pageMap = (await getPageMap()).filter((item) => {
    if (!('route' in item)) return true;
    const route = item.route.replace(/\/$/, '') || '/';
    return !landingRoutes.has(route);
  });
  return (
    <Layout
      darkMode={false}
      nextThemes={{ forcedTheme: 'dark' }}
      navbar={
        <Navbar
          logo={
            <span className="mink-brand">
              <img src={withBasePath('/logo.png')} alt="" width="32" height="32" />
              mink<span className="mink-alpha">alpha 0.1</span>
            </span>
          }
          projectLink="https://github.com/yaroslavlky/mink"
        />
      }
      pageMap={pageMap}
      docsRepositoryBase="https://github.com/yaroslavlky/mink/tree/main/apps/docs/content"
      editLink="Edit this page on GitHub"
      footer={<Footer>MIT · Mink · A calmer way to run your repository.</Footer>}
    >
      {children}
    </Layout>
  );
}
