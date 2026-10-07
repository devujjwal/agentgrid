import type { NextConfig } from 'next';

const designPreview = process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1';
if (designPreview && (process.env.CI || process.env.GITHUB_ACTIONS))
  throw new Error('Unpublished design fixtures cannot be built in CI.');

const config: NextConfig = {
  output: 'export',
  distDir: designPreview ? '.agentgrid-local-preview' : '.next',
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
