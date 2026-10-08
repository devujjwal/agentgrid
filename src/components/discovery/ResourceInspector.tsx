import Link from 'next/link';
import type { DiscoveryResource } from '../../domain/discovery';
import type { UniverseRelation } from '../universe/model';

export const categoryLabel = (value: string) =>
  value === 'seo' ? 'SEO' : value.replaceAll('-', ' ');

export function ResourceInspector({
  selected,
  relations,
}: {
  selected: DiscoveryResource | undefined;
  relations: readonly UniverseRelation[];
}) {
  const connections = [
    ...new Set(
      relations
        .filter((edge) => edge.source === selected?.slug || edge.target === selected?.slug)
        .map((edge) => edge.capability),
    ),
  ];
  return (
    <aside
      className="resource-inspector"
      id="resource-inspector"
      tabIndex={-1}
      aria-labelledby="inspector-title"
    >
      <div className="inspector-meta">
        <span className="eyebrow">Resource signal</span>
        <span className="draft-status">
          {!selected
            ? 'No selection'
            : selected.state === 'editorial'
              ? 'Editorial guide'
              : selected?.state === 'published'
                ? 'Published'
                : 'Draft'}
        </span>
      </div>
      {selected ? (
        <>
          <p className="resource-category">{categoryLabel(selected.category)}</p>
          <h3 id="inspector-title">{selected.title}</h3>
          <p className="resource-description">{selected.summary}</p>
          <div className="inspector-rule" />
          <p className="eyebrow">What it helps with</p>
          <ul className="capability-list">
            {selected.capabilities.map((capability) => (
              <li key={capability}>
                <span aria-hidden="true">↳</span>
                {capability}
              </li>
            ))}
          </ul>
          <dl className="resource-facts">
            <div>
              <dt>Format</dt>
              <dd>
                {selected.format === 'guide'
                  ? 'Category guide'
                  : selected.format === 'instructions'
                    ? 'Interactive instructions'
                    : selected.format === 'recipe'
                      ? 'Guided recipe'
                      : 'Workflow resource'}
              </dd>
            </div>
            <div>
              <dt>Creator</dt>
              <dd>{selected.creatorName}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {selected.state === 'editorial'
                  ? 'Practical selection guidance'
                  : selected.state === 'published'
                    ? 'Published resource'
                    : selected.kind === 'recipe'
                      ? 'Workflow review pending'
                      : 'Host testing pending'}
              </dd>
            </div>
          </dl>
          {connections.length > 0 && (
            <div className="related-signals">
              <p className="eyebrow">Connected through</p>
              <p>{connections.join(' · ')}</p>
            </div>
          )}
          <p className="inspector-note">
            {selected.state === 'editorial'
              ? 'A guide to choosing useful work, preparing inputs and checking results. Linked agents have their own publication and verification status.'
              : selected.state === 'draft'
                ? selected.kind === 'recipe'
                  ? 'An unpublished guided recipe. Its agent versions and complete sequence must pass review before publication.'
                  : 'An unpublished first-party draft. Reuse terms and platform verification are required before distribution.'
                : 'Read the setup, examples and permissions before using this resource.'}
          </p>
          <Link prefetch={false} className="inspector-open" href={selected.href}>
            Read the full resource <span aria-hidden="true">↗</span>
          </Link>
        </>
      ) : (
        <>
          <h3 id="inspector-title">No matching resource.</h3>
          <p>Change your task or discipline to explore another connection.</p>
        </>
      )}
    </aside>
  );
}
