import nextra from 'nextra';
const withNextra = nextra({});
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, '') || undefined;
export default withNextra({
  agentRules: false,
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
});
