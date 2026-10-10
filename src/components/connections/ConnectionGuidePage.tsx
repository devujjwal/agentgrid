import { reviewedEditorialPaths } from '../../domain/editorial-discovery';
import { socialImage } from '../../domain/social-metadata';
import { DeclaredResources } from './DeclaredResources';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFrame } from '../layout/SiteFrame';
import { connectionGuides } from '../../data/connections';
import { categoryGuides } from '../../data/categories';
import { resourceDocuments } from '../../data/resources';
import { categoryPath } from '../../domain/category';
import {
  connectionPath,
  connectionSection,
  declaresConnection,
  needsConnectionReview,
  type ConnectionKind,
} from '../../domain/connection-guide';
import { serializeStructuredData } from '../../domain/public-resource';
import '../../app/learn/learning.css';
import '../../app/categories/categories.css';
import { connectionLabel as label } from './connection-label';
const find = (kind: ConnectionKind, slug: string) =>
  connectionGuides.find((item) => item.kind === kind && item.slug === slug) ?? notFound();
export function connectionMetadata(kind: ConnectionKind, slug: string): Metadata {
  const item = find(kind, slug);
  return {
    title: `${item.name} — setup and connection guidance | AgentGrid`,
    description: item.summary,
    alternates: { canonical: connectionPath(item) },
    robots: {
      index:
        process.env.AGENTGRID_BUILD_STAGE === 'production' &&
        reviewedEditorialPaths.includes(connectionPath(item)) &&
        !needsConnectionReview(item),
      follow: process.env.AGENTGRID_BUILD_STAGE === 'production',
    },
    openGraph: {
      images: [socialImage],
      type: 'article',
      title: item.name,
      description: item.summary,
      url: connectionPath(item),
    },
    twitter: {
      card: 'summary_large_image',
      images: [socialImage],
      title: item.name,
      description: item.summary,
    },
  };
}
export function ConnectionGuidePage({ kind, slug }: { kind: ConnectionKind; slug: string }) {
  const item = find(kind, slug),
    path = connectionPath(item),
    reviewNeeded = needsConnectionReview(item);
  const resources = resourceDocuments().filter((document) =>
    declaresConnection(document.specification, item),
  );
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'AgentGrid',
                  item: 'https://agentgrid.me/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: label(kind),
                  item: `https://agentgrid.me/${connectionSection(kind)}/`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: item.name,
                  item: `https://agentgrid.me${path}`,
                },
              ],
            }),
          }}
        />
        <nav aria-label="Breadcrumb" className="learning-breadcrumb">
          <Link prefetch={false} href="/">
            AgentGrid
          </Link>
          <span aria-hidden="true">/</span>
          <Link prefetch={false} href={`/${connectionSection(kind)}/`}>
            {label(kind)}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{item.name}</span>
        </nav>
        <header className="learning-header">
          <p className="eyebrow">{label(kind)} / Understand the connection</p>
          <h1>{item.name}</h1>
          <p className="learning-summary">{item.summary}</p>
          <div className="learning-byline">
            <span>AgentGrid Editorial</span>
            <span>
              Documentation checked <time dateTime={item.checked_on}>{item.checked_on}</time>
            </span>
            <span>Guidance · not a compatibility certification</span>
          </div>
        </header>
        <div className="learning-layout">
          <aside className="learning-toc">
            <p className="eyebrow">Before connecting</p>
            <p>
              Read the agent’s exact requirements. A provider name alone does not identify the
              tools, permissions or tested setup.
            </p>
            <a href="#checklist">Your connection checklist ↓</a>
            <p>
              <a href="#sources">Official documentation ↗</a>
            </p>
          </aside>
          <article className="learning-body">
            {reviewNeeded && (
              <section className="discipline-stop">
                <h2>Recheck the current setup.</h2>
                <p>
                  This guide is due for a documentation review. Provider interfaces and access rules
                  may have changed. Consult the official sources below before following these steps.
                </p>
              </section>
            )}
            {item.sections.map((section, index) => (
              <section key={section.title}>
                <p className="eyebrow">{String(index + 1).padStart(2, '0')} / Connection context</p>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
                {index === 0 && (
                  <p>
                    <a href="#sources">Read the official sources for this guide ↓</a>
                  </p>
                )}
              </section>
            ))}
            <section id="checklist">
              <h2>Check before you continue.</h2>
              <ul className="discipline-inputs">
                {item.checklist.map((value) => (
                  <li key={value}>{value}</li>
                ))}
              </ul>
              <p>
                AgentGrid does not ask you to paste an API key or connect an account on this page.
                Any provider access, subscription or usage charge is separate.
              </p>
            </section>
            <DeclaredResources kind={kind} resources={resources} />
            <section id="sources">
              <h2>Official sources, checked on {item.checked_on}.</h2>
              <p>
                Provider facts above are drawn from these sources. Testing and review
                recommendations are AgentGrid’s editorial guidance.
              </p>
              <ul className="discipline-inputs">
                {item.sources.map((source) => (
                  <li key={source.url}>
                    <a href={source.url} rel="noopener noreferrer">
                      {source.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
              <p>
                Next documentation review due:{' '}
                <time dateTime={item.review_after}>{item.review_after}</time>.
              </p>
            </section>
            <nav aria-label="Related guidance" className="learning-related">
              {item.categories.map((slug) => (
                <Link prefetch={false} key={slug} href={categoryPath(slug)}>
                  {categoryGuides.find((category) => category.slug === slug)!.name} guide ↗
                </Link>
              ))}
              <Link prefetch={false} href="/learn/permissions-and-source-material/">
                Permissions and source material ↗
              </Link>
              {kind !== 'mcp' && (
                <Link prefetch={false} href="/mcp/understanding-mcp/">
                  Understand MCP ↗
                </Link>
              )}
            </nav>
          </article>
        </div>
      </main>
    </SiteFrame>
  );
}
