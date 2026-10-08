import Link from 'next/link';
import type { ReactNode } from 'react';
import { NetworkMark } from '../brand/NetworkMark';

export function SiteFrame({
  children,
  localPreview,
}: {
  children: ReactNode;
  localPreview: boolean;
}) {
  return (
    <div
      className="agentgrid-site"
      {...(localPreview ? { 'data-agentgrid-preview': 'local-only' } : {})}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {localPreview && (
        <div className="preview-notice">
          Local design preview <span aria-hidden="true">/</span> Unpublished drafts · no verified
          platform claims
        </div>
      )}
      <header className="site-header">
        <Link prefetch={false} className="brand" href="/" aria-label="AgentGrid.me home">
          <NetworkMark />
          <span>
            agentgrid<span className="brand-domain">.me</span>
          </span>
        </Link>
        <nav aria-label="Primary">
          <Link prefetch={false} href="/agents/">
            Discover
          </Link>
          <Link prefetch={false} href="/#universe">
            Agent Universe<span aria-hidden="true">↗</span>
          </Link>
          <Link prefetch={false} href="/recipes/">
            Recipes
          </Link>
          <Link prefetch={false} href="/learn/">
            Learn
          </Link>
        </nav>
        <Link prefetch={false} className="header-workspace" href="/workspace/">
          Workspace <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {children}
      <footer className="site-footer">
        <Link prefetch={false} className="brand" href="/">
          <NetworkMark />
          <span>agentgrid.me</span>
        </Link>
        <p>Useful intelligence. Connected.</p>
        <Link prefetch={false} href="/categories/">
          Explore categories
        </Link>
        <Link prefetch={false} href="/learn/">
          Learn to use agents
        </Link>
        <Link prefetch={false} href="/platforms/">
          Platforms
        </Link>
        <Link prefetch={false} href="/integrations/">
          Integrations
        </Link>
        <Link prefetch={false} href="/mcp/">
          MCP
        </Link>
        <span>{localPreview ? 'First-party draft foundation' : 'The agent network'}</span>
      </footer>
    </div>
  );
}
