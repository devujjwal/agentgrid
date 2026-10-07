'use client';

import { useMemo, useState } from 'react';
import type { DiscoveryResource } from '../../domain/discovery';
import { searchCatalogue } from '../../domain/discovery';
import { UniverseViewport } from '../universe/UniverseViewport';
import { ResourceInspector, categoryLabel } from './ResourceInspector';
import { TaskCommand } from './TaskCommand';

export function DiscoveryConsole({ resources }: { resources: DiscoveryResource[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [selectedSlug, setSelectedSlug] = useState('source-evidence-mapper');
  const categories = useMemo(
    () => [...new Set(resources.map((item) => item.category))].sort(),
    [resources],
  );
  const matches = useMemo(
    () => searchCatalogue(resources, { text: query, ...(category ? { category } : {}) }),
    [resources, query, category],
  );
  const activeSlug = matches.some((match) => match.resource.slug === selectedSlug)
    ? selectedSlug
    : (matches[0]?.resource.slug ?? '');
  const selected = resources.find((resource) => resource.slug === activeSlug);

  function inspect(slug: string, focusDetails = true) {
    setSelectedSlug(slug);
    if (focusDetails) {
      requestAnimationFrame(() => {
        const details = document.getElementById('resource-inspector');
        details?.focus({ preventScroll: true });
        details?.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
    }
  }

  return (
    <>
      <TaskCommand
        query={query}
        onQuery={setQuery}
        onPrompt={(prompt) => {
          setQuery(prompt);
          setCategory('');
        }}
        onExplore={() => document.getElementById('discovery-results')?.focus()}
      />

      <section className="network-section" id="universe" aria-labelledby="network-heading">
        <div className="section-intro">
          <div>
            <p className="eyebrow">01 / Explore the connections</p>
            <h2 id="network-heading">A universe of useful possibilities.</h2>
          </div>
          <p>
            Start with a task. Follow a connection.
            <br />
            Find something you can actually work with.
          </p>
        </div>
        <div className="network-layout">
          <div className="universe-panel">
            <div className="universe-toolbar">
              <span className="eyebrow">Agent Universe</span>
              <span className="map-key">
                <i aria-hidden="true" />
                Resource <span aria-hidden="true">·</span> Shared capability
              </span>
            </div>
            <UniverseViewport
              resources={resources}
              matchedSlugs={matches.map((match) => match.resource.slug)}
              selectedSlug={activeSlug}
              onSelect={inspect}
            />
            <div className="universe-caption">
              <span>Connections describe shared capabilities.</span>
              <span>Interactive instructions / Drafts</span>
            </div>
          </div>
          <ResourceInspector selected={selected} />
        </div>
      </section>

      <section className="catalogue-section" aria-labelledby="catalogue-heading">
        <div className="section-intro">
          <div>
            <p className="eyebrow">02 / Find your starting point</p>
            <h2 id="catalogue-heading">Useful work, across your world.</h2>
          </div>
          <p>
            Writing, learning, business, everyday life.
            <br />A broad library starts with specific problems.
          </p>
        </div>
        <div className="catalogue-tools">
          <label htmlFor="category-filter" className="eyebrow">
            Explore a discipline
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">All disciplines</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {categoryLabel(item)}
              </option>
            ))}
          </select>
          <span className="result-count" role="status" aria-live="polite">
            {matches.length} {matches.length === 1 ? 'draft resource' : 'draft resources'}
            {query ? ` for “${query}”` : ''}
          </span>
        </div>
        <div
          id="discovery-results"
          tabIndex={-1}
          role="region"
          aria-label="Matching draft resources"
        >
          {matches.length ? (
            <ul className="resource-list">
              {matches.map(({ resource }, index) => (
                <li key={resource.slug}>
                  <button
                    type="button"
                    className="resource-row"
                    onClick={() => inspect(resource.slug)}
                  >
                    <span className="row-index" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="row-category">{categoryLabel(resource.category)}</span>
                    <span className="row-main">
                      <strong>{resource.title}</strong>
                      <span>{resource.summary}</span>
                    </span>
                    <span className="row-format">
                      Instructions<span>Draft · unverified</span>
                    </span>
                    <span className="row-arrow" aria-hidden="true">
                      ↗
                    </span>
                    <span className="sr-only">Inspect draft</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-results">
              <h3>No matching draft yet.</h3>
              <p>
                Try a more specific task or explore another discipline. The draft foundation is
                intentionally small; it is not the launch library.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategory('');
                }}
              >
                Show all drafts <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
