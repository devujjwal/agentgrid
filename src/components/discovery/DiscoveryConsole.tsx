'use client';

import { CatalogueResults } from './CatalogueResults';

import { useMemo, useState } from 'react';
import type { DiscoveryResource } from '../../domain/discovery';
import { createCatalogueSearch } from '../../domain/discovery';
import { useDiscoverySearch } from './useDiscoverySearch';
import { universeRelations } from '../universe/model';
import { UniverseViewport } from '../universe/UniverseViewport';
import { ResourceInspector } from './ResourceInspector';
import { TaskCommand } from './TaskCommand';

export function DiscoveryConsole({ resources }: { resources: DiscoveryResource[] }) {
  const relations = useMemo(() => universeRelations(resources), [resources]);
  const drafts = resources.every((resource) => resource.state === 'draft');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState<DiscoveryResource['kind'] | ''>('');
  const kinds = useMemo(() => [...new Set(resources.map((item) => item.kind))], [resources]);
  const [page, setPage] = useState(0);
  const [selectedSlug, setSelectedSlug] = useState('source-evidence-mapper');
  const categories = useMemo(
    () => [...new Set(resources.map((item) => item.category))].sort(),
    [resources],
  );
  const provider = useMemo(() => createCatalogueSearch(resources), [resources]);
  const searchQuery = useMemo(
    () => ({
      text: query,
      ...(category ? { category } : {}),
      ...(kind ? { kinds: [kind] } : {}),
      offset: page * 30,
    }),
    [query, category, kind, page],
  );
  const search = useDiscoverySearch(provider, searchQuery);
  const searchPage = search.page;
  const matches = searchPage.matches;
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
        draftCatalogue={drafts}
        onQuery={(value) => {
          setQuery(value);
          setPage(0);
        }}
        onPrompt={(prompt) => {
          setQuery(prompt);
          setCategory('');
          setKind('');
          setPage(0);
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
              relations={relations}
              matchedSlugs={matches.map((match) => match.resource.slug)}
              selectedSlug={activeSlug}
              onSelect={inspect}
            />
            <div className="universe-caption">
              <span>Connections describe shared capabilities.</span>
              <span>
                {drafts ? 'Interactive instructions / Drafts' : 'Agents, recipes & guides'}
              </span>
            </div>
          </div>
          <ResourceInspector relations={relations} selected={selected} />
        </div>
      </section>

      <CatalogueResults
        searchPage={searchPage}
        pending={search.pending}
        failed={search.failed}
        onRetry={search.retry}
        query={query}
        category={category}
        categories={categories}
        kind={kind}
        kinds={kinds}
        onKind={(value) => {
          setKind(value);
          setPage(0);
        }}
        drafts={drafts}
        onCategory={(value) => {
          setCategory(value);
          setPage(0);
        }}
        onInspect={inspect}
        onReset={() => {
          setQuery('');
          setCategory('');
          setKind('');
          setPage(0);
        }}
        onPage={(value) => {
          setPage(value);
          requestAnimationFrame(() => {
            const results = document.getElementById('discovery-results');
            results?.focus({ preventScroll: true });
            results?.scrollIntoView({ block: 'start', behavior: 'instant' });
          });
        }}
      />
    </>
  );
}
