import Link from 'next/link';
import type { DiscoveryPage, DiscoveryResource } from '../../domain/discovery';
import { categoryLabel } from './ResourceInspector';
export function CatalogueResults({
  searchPage,
  pending,
  failed,
  onRetry,
  query,
  category,
  categories,
  kind,
  kinds,
  onKind,
  drafts,
  onCategory,
  onInspect,
  onReset,
  onPage,
}: {
  searchPage: DiscoveryPage;
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
  query: string;
  category: string;
  categories: string[];
  kind: DiscoveryResource['kind'] | '';
  kinds: DiscoveryResource['kind'][];
  onKind: (value: DiscoveryResource['kind'] | '') => void;
  drafts: boolean;
  onCategory: (value: string) => void;
  onInspect: (slug: string) => void;
  onReset: () => void;
  onPage: (page: number) => void;
}) {
  const matches = searchPage.matches;
  const page = Math.floor(searchPage.offset / 30);
  return (
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
          onChange={(event) => {
            onCategory(event.target.value);
          }}
        >
          <option value="">All disciplines</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {categoryLabel(item)}
            </option>
          ))}
        </select>
        {kinds.length > 1 && (
          <div className="resource-kind-filter">
            <label htmlFor="kind-filter" className="eyebrow">
              Resource type
            </label>
            <select
              id="kind-filter"
              value={kind}
              onChange={(event) => {
                const value = event.target.value;
                if (value === '' || kinds.includes(value as DiscoveryResource['kind']))
                  onKind(value as DiscoveryResource['kind'] | '');
              }}
            >
              <option value="">All types</option>
              {kinds.map((value) => (
                <option key={value} value={value}>
                  {value === 'agent'
                    ? 'Agents'
                    : value === 'recipe'
                      ? 'Recipes'
                      : value === 'category'
                        ? 'Category guides'
                        : 'Integrations'}
                </option>
              ))}
            </select>
          </div>
        )}
        <span className="result-count" role="status" aria-live="polite">
          {pending ? (
            'Finding matching resources…'
          ) : failed ? (
            'Discovery is temporarily unavailable.'
          ) : (
            <>
              {searchPage.total}{' '}
              {searchPage.total === 1
                ? drafts
                  ? 'draft resource'
                  : 'resource'
                : drafts
                  ? 'draft resources'
                  : 'resources'}
              {query ? ` for “${query}”` : ''}
            </>
          )}
        </span>
      </div>
      <div
        id="discovery-results"
        tabIndex={-1}
        role="region"
        aria-label={drafts ? 'Matching draft resources' : 'Matching resources'}
        aria-busy={pending}
      >
        {failed ? (
          <div className="empty-results">
            <p>Discovery could not finish. Your query has been kept.</p>
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : matches.length ? (
          <ul className="resource-list">
            {matches.map(({ resource }, index) => (
              <li key={resource.slug}>
                <div className="resource-row">
                  <span className="row-index" aria-hidden="true">
                    {String(searchPage.offset + index + 1).padStart(2, '0')}
                  </span>
                  <span className="row-category">{categoryLabel(resource.category)}</span>
                  <span className="row-main">
                    <Link prefetch={false} href={resource.href}>
                      <strong>{resource.title}</strong>
                    </Link>
                    <span>{resource.summary}</span>
                  </span>
                  <span className="row-format">
                    {resource.format === 'guide'
                      ? resource.kind === 'category'
                        ? 'Category guide'
                        : 'Integration guide'
                      : resource.format === 'instructions'
                        ? 'Instructions'
                        : resource.format === 'recipe'
                          ? 'Recipe'
                          : 'Workflow'}
                    <span>
                      {resource.state === 'editorial'
                        ? 'Editorial'
                        : resource.state === 'draft'
                          ? 'Draft · unverified'
                          : 'Published'}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="row-arrow row-inspect"
                    onClick={() => onInspect(resource.slug)}
                    aria-label={`Inspect connections for ${resource.title}`}
                  >
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : pending ? (
          <p className="empty-results">Finding matching resources…</p>
        ) : (
          <div className="empty-results">
            <h3>{drafts ? 'No matching draft yet.' : 'No matching resource yet.'}</h3>
            <p>
              Try a more specific task or explore another discipline.{' '}
              {drafts
                ? 'These unpublished drafts are still undergoing editorial and platform review.'
                : 'This task may not have a suitable match yet. Check each result’s publication and verification status.'}
            </p>
            <button
              type="button"
              onClick={() => {
                onReset();
              }}
            >
              {drafts ? 'Show all drafts' : 'Show all resources'} <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}
      </div>
      {searchPage.total > 30 && (
        <nav className="result-pagination" aria-label="Resource result pages">
          <button
            type="button"
            disabled={pending || page === 0}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            Previous page
          </button>
          <span aria-live="polite">
            Page {page + 1} of {Math.ceil(searchPage.total / 30)}
          </span>
          <button
            type="button"
            disabled={pending || (page + 1) * 30 >= searchPage.total}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            Next page
          </button>
        </nav>
      )}
    </section>
  );
}
