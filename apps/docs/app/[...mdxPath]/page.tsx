import type { Metadata } from 'next';
import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents as getMDXComponents } from '../../mdx-components';
import { defaultDescription, ogImage, siteName } from '@/lib/seo';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

type Props = { params: Promise<{ mdxPath: string[] }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { mdxPath } = await props.params;
  const { metadata } = await importPage(mdxPath);
  const title = typeof metadata.title === 'string' ? metadata.title : 'Mink documentation';
  const fullTitle = `${title} · Mink`;
  const description = metadata.description ?? defaultDescription;
  const canonical = `/${mdxPath.join('/')}/`;

  return {
    ...metadata,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      siteName,
      title: fullTitle,
      description,
      url: canonical,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage.url],
    },
  };
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props: Props) {
  const params = await props.params;
  const { default: Content, toc, metadata, sourceCode } = await importPage(params.mdxPath);
  return (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <Content {...props} params={params} />
    </Wrapper>
  );
}
