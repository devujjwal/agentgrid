import type { NextConfig } from 'next';

const designPreview = process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1';
if (designPreview && (process.env.CI || process.env.GITHUB_ACTIONS))
  throw new Error('Unpublished design fixtures cannot be built in CI.');

const config: NextConfig = {
  output: 'export',
  // Test pages are not production entry points, including their client chunks.
  pageExtensions: designPreview ? ['qa.tsx', 'tsx', 'ts', 'jsx', 'js'] : ['tsx', 'ts', 'jsx', 'js'],
  distDir: designPreview ? '.agentgrid-local-preview' : '.next',
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
