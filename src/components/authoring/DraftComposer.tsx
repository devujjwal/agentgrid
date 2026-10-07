'use client';
import { useRef } from 'react';
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

export function DraftComposer({
  value,
  change,
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
  const current = sections[section] ?? sections[0];
  function navigate(index: number) {
    changeSection(index);
    requestAnimationFrame(() => heading.current?.focus());
  }
  return (
    <div className="draft-studio">
      <nav className="draft-map" aria-label="Agent definition sections">
        <ol>
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
          <p className="eyebrow">Definition / {String(section + 1).padStart(2, '0')}</p>
          <h2 ref={heading} tabIndex={-1}>
            {current.title}
          </h2>
          <p>{current.description}</p>
        </header>
        {sourceVersionId && (
          <p className="draft-lineage">
            Forked from immutable version {sourceVersionId}. Source attribution and reuse conditions
            are retained.
          </p>
        )}
        <fieldset disabled={busy || readOnly} className="draft-fields">
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
        <PortableDraft
          value={value}
          change={change}
          inherited={Boolean(sourceVersionId)}
          readOnly={busy || readOnly}
        />
        <DefinitionReadiness value={value} />
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
