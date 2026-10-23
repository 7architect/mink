import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents as getMDXComponents } from '../../mdx-components';
export const generateStaticParams = generateStaticParamsFor('mdxPath');
type Props = { params: Promise<{ mdxPath?: string[] }> };
export async function generateMetadata(props: Props) {
  const { mdxPath } = await props.params;
  return (await importPage(mdxPath)).metadata;
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
