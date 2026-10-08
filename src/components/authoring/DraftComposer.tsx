'use client';
import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { sections } from './sections';
import { DefinitionReadiness } from './DefinitionReadiness';
import type { DraftSpecification } from '../../domain/draft';
import { IntentBehavior } from './IntentBehavior';
import { ExchangeFields } from './ExchangeFields';
import { PlatformFields } from './PlatformFields';
import { AccessFields } from './AccessFields';
import { ExamplesBoundaries } from './ExamplesBoundaries';
import { ReuseFields } from './ReuseFields';
import { PortableDraft } from './PortableDraft';
import type { DraftEditorial } from '../../domain/draft-editorial';
const guideLoading = () => <p role="status">Loading guide tools…</p>;
const GuideFields = dynamic(() => import('./GuideFields').then((module) => module.GuideFields), {
  loading: guideLoading,
});
const GuideReadiness = dynamic(
  () => import('./GuideReadiness').then((module) => module.GuideReadiness),
  { loading: guideLoading },
);
const PortableGuide = dynamic(
  () => import('./PortableGuide').then((module) => module.PortableGuide),
  { loading: guideLoading },
);

export function DraftComposer({
  value,
  change,
  editorial,
  changeEditorial,
  sourceVersionId,
  revision,
  dirty,
  busy,
  save,
  section,
  changeSection,
  readOnly = false,
}: {
  value: DraftSpecification;
  editorial: DraftEditorial;
  changeEditorial: (value: DraftEditorial) => void;
  change: (value: DraftSpecification) => void;
  sourceVersionId: string | null;
  revision: number;
  dirty: boolean;
  busy: boolean;
  save: () => void;
  section: number;
  changeSection: (index: number) => void;
  readOnly?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const map = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = map.current;
    if (!list) return;
    const reveal = () => {
      const active = list.querySelector<HTMLElement>("[aria-current='step']");
      if (!active || list.scrollWidth <= list.clientWidth) return;
      const item = active.getBoundingClientRect(),
        viewport = list.getBoundingClientRect();
      if (item.left < viewport.left) list.scrollLeft += item.left - viewport.left;
      else if (item.right > viewport.right) list.scrollLeft += item.right - viewport.right;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(list);
    return () => observer.disconnect();
  }, [section]);
  const current = sections[section] ?? sections[0];
  const guideSection = ['guide', 'sources', 'guide-readiness'].includes(current.id);
  function navigate(index: number) {
    changeSection(index);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <div className="draft-studio">
      <nav className="draft-map" aria-label="Agent authoring sections">
        <ol ref={map}>
          {sections.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={section === index ? 'step' : undefined}
                onClick={() => navigate(index)}
              >
                <span className="draft-node" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ol>
        <p>
          Private draft
          <br />
          Revision {revision}
        </p>
      </nav>
      <div className="draft-workbench">
        <header>
          <p className="eyebrow">
            {guideSection ? 'Public guide' : 'Definition'} / {String(section + 1).padStart(2, '0')}
          </p>
          <h2 ref={heading} tabIndex={-1}>
            {current.title}
          </h2>
          <p>{current.description}</p>
        </header>
        {sourceVersionId && (
          <p className="draft-lineage">
            This draft is a fork. Its source attribution and reuse conditions are retained.
          </p>
        )}
        <fieldset disabled={busy || readOnly} className="draft-fields">
          {current.id === 'guide' && <GuideFields value={editorial} change={changeEditorial} />}
          {current.id === 'sources' && (
            <GuideFields value={editorial} change={changeEditorial} sources />
          )}
          {current.id === 'guide-readiness' && (
            <GuideReadiness value={editorial} change={changeEditorial} />
          )}
          {current.id === 'intent' && <IntentBehavior value={value} change={change} />}
          {current.id === 'behavior' && <IntentBehavior value={value} change={change} behavior />}
          {current.id === 'exchange' && <ExchangeFields value={value} change={change} />}
          {current.id === 'platforms' && <PlatformFields value={value} change={change} />}
          {current.id === 'access' && <AccessFields value={value} change={change} />}
          {current.id === 'examples' && <ExamplesBoundaries value={value} change={change} />}
          {current.id === 'boundaries' && (
            <ExamplesBoundaries value={value} change={change} boundaries />
          )}
          {current.id === 'reuse' && (
            <ReuseFields value={value} change={change} inherited={Boolean(sourceVersionId)} />
          )}
        </fieldset>
        {guideSection ? (
          <PortableGuide
            value={editorial}
            change={changeEditorial}
            slug={value.identity.slug}
            readOnly={busy || readOnly}
          />
        ) : (
          <>
            <PortableDraft
              value={value}
              change={change}
              inherited={Boolean(sourceVersionId)}
              readOnly={busy || readOnly}
            />
            <DefinitionReadiness value={value} />
          </>
        )}
        <footer className="draft-save-bar">
          <p>
            {readOnly
              ? 'Editing is restricted.'
              : dirty
                ? 'Unsaved changes in this browser.'
                : 'No unsaved changes.'}
            <span>Saving keeps this draft private.</span>
          </p>
          <button
            type="button"
            className="action-primary"
            disabled={busy || readOnly || !dirty}
            onClick={save}
          >
            {busy ? 'Saving…' : 'Save private draft'}
            <span aria-hidden="true">↗</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
