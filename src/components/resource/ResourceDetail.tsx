import { platformLabel } from '../../domain/platforms';
import { ResourceReuse } from './ResourceReuse';
import { SaveAgent } from './SaveAgent';
import { ResourceBoundaries } from './ResourceBoundaries';
import { ResourceExamples } from './ResourceExamples';
import { ResourceInputs } from './ResourceInputs';
import Link from 'next/link';
import type { ResourceDocument } from '../../data/resources';
import { SiteFrame } from '../layout/SiteFrame';
import { AgentGlyph } from '../universe/AgentGlyph';
import { ResourceSetup } from './ResourceSetup';
import { categoryLabel } from '../discovery/ResourceInspector';
import { resourceStructuredData, serializeStructuredData } from '../../domain/public-resource';

export function ResourceDetail({
  document,
  related,
}: {
  document: ResourceDocument;
  related: ResourceDocument[];
}) {
  const { specification: spec, publication } = document;
  const editorial = publication?.editorial;
  return (
    <SiteFrame localPreview={!publication}>
      {publication && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(resourceStructuredData(publication)),
          }}
        />
      )}
      <main id="main-content" className="resource-detail">
        <nav className="resource-breadcrumbs" aria-label="Breadcrumb">
          <Link prefetch={false} href="/">
            AgentGrid
          </Link>
          <span aria-hidden="true">/</span>
          <Link prefetch={false} href="/agents/">
            Agents
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{spec.identity.name}</span>
        </nav>
        <header className="resource-hero">
          <div>
            <p className="eyebrow">
              {categoryLabel(spec.category)} <span aria-hidden="true">/</span>{' '}
              {spec.execution.mode === 'interactive'
                ? 'Interactive instructions'
                : 'Workflow resource'}
            </p>
            <h1>{spec.identity.name}</h1>
            <p className="resource-summary">{spec.identity.summary}</p>
            <div className="resource-action-row">
              {publication ? (
                <a className="primary-action" href="#use-agent">
                  Use agent <span aria-hidden="true">↗</span>
                </a>
              ) : (
                <span className="draft-status">Unpublished draft · distribution unavailable</span>
              )}
              <span className="resource-version">Version {spec.version}</span>
              {publication && (
                <SaveAgent resourceId={publication.resource_id} slug={spec.identity.slug} />
              )}
            </div>
          </div>
          <svg className="resource-emblem" viewBox="-48 -48 96 96" aria-hidden="true">
            <circle r="42" />
            <circle r="26" />
            <AgentGlyph category={spec.category} />
          </svg>
        </header>
        <dl className="resource-facts">
          <div>
            <dt>Creator</dt>
            <dd>{publication?.creator.name ?? 'AgentGrid Editorial draft'}</dd>
          </div>
          <div>
            <dt>Platforms</dt>
            <dd>{spec.platforms.map((item) => platformLabel(item.slug)).join(', ')}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>Free · platform costs may apply</dd>
          </div>
          <div>
            <dt>{publication ? 'Last published' : 'Verification'}</dt>
            <dd>
              {publication ? (
                <time dateTime={publication.released_at}>
                  {publication.released_at.slice(0, 10)}
                </time>
              ) : (
                'Host testing pending'
              )}
            </dd>
          </div>
        </dl>
        <div className="resource-body-layout">
          <nav className="resource-toc" aria-label="On this page">
            <span className="eyebrow">Inside this resource</span>
            <a href="#overview">Overview</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#requirements">Requirements</a>
            <a href="#use-agent">Setup & instructions</a>
            <a href="#examples">Examples</a>
            <a href="#boundaries">Limits & privacy</a>
            <a href="#reuse">Reuse terms</a>
            {editorial && <a href="#questions">Questions & sources</a>}
          </nav>
          <div className="resource-sections">
            <section className="resource-section" id="overview">
              <p className="eyebrow">What this resource does</p>
              <h2>A useful starting point.</h2>
              <p>{editorial?.overview ?? spec.purpose}</p>
              {editorial && (
                <>
                  <h3>Who it suits</h3>
                  <ul>
                    {editorial.audience.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <h3>How it works</h3>
                  <ol>
                    {editorial.workflow.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </>
              )}
            </section>
            <section className="resource-section" id="capabilities">
              <h2>Capabilities</h2>
              <div className="capability-ledger">
                {spec.capabilities.map((item) => (
                  <div key={item.id}>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            </section>
            <ResourceInputs specification={spec} />
            <ResourceSetup specification={spec} publication={publication} />
            <ResourceExamples specification={spec} />
            <ResourceBoundaries specification={spec} />
            <ResourceReuse specification={spec} publication={publication} />
            {editorial && (
              <section className="resource-section" id="questions">
                <h2>Questions, answered.</h2>
                {editorial.faq.map((item) => (
                  <details className="example-disclosure" key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
                <h3>Factual sources</h3>
                <ul>
                  {editorial.sources.map((item) => (
                    <li key={item.url}>
                      <a href={item.url} rel="noopener noreferrer">
                        {item.title}
                      </a>
                      <p>{item.supports}</p>
                      <small>
                        Checked <time dateTime={item.checked_on}>{item.checked_on}</time>
                      </small>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {related.length > 0 && (
              <section className="resource-section" id="related">
                <h2>Continue the connection.</h2>
                <ul className="related-resources">
                  {related.map((item) => (
                    <li key={item.specification.identity.slug}>
                      <Link prefetch={false} href={`/agents/${item.specification.identity.slug}/`}>
                        <strong>{item.specification.identity.name}</strong>
                        <span>{item.specification.identity.summary}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </SiteFrame>
  );
}
