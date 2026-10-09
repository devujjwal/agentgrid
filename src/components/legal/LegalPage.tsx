import type { ReactNode } from 'react';
import Link from 'next/link';
import { SiteFrame } from '../layout/SiteFrame';
import { legalOperator } from '../../domain/legal';
import './legal.css';

export function LegalPage({
  title,
  summary,
  version,
  sections,
}: {
  title: string;
  summary: string;
  version: string;
  sections: { id: string; title: string; body: ReactNode }[];
}) {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="legal-page">
        <header className="legal-header">
          <p className="eyebrow">AgentGrid / Trust &amp; ownership</p>
          <h1>{title}</h1>
          <p className="legal-summary">{summary}</p>
          <div className="legal-record">
            <span>Version {version}</span>
            <span>
              {legalOperator.name} · {legalOperator.country}
            </span>
          </div>
        </header>
        <div className="legal-layout">
          <nav className="legal-contents" aria-label="On this page">
            <p className="eyebrow">In this document</p>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={'#' + section.id}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="legal-body">
            {sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.body}
              </section>
            ))}
          </div>
        </div>
        <aside className="legal-contact">
          <div>
            <p className="eyebrow">A person behind the network</p>
            <h2>Questions about these terms?</h2>
            <p>
              AgentGrid is operated by {legalOperator.name}, an individual in{' '}
              {legalOperator.country}.
            </p>
          </div>
          <Link prefetch={false} href="/contact/">
            Contact the operator <span aria-hidden="true">↗</span>
          </Link>
        </aside>
      </main>
    </SiteFrame>
  );
}
