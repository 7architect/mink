import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs';
import type { MDXComponents } from 'nextra/mdx-components';
const components = getThemeComponents();
export function useMDXComponents(overrides: MDXComponents = {}) {
  return { ...components, ...overrides };
}
