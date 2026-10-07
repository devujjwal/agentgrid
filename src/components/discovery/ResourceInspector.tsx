import type { DiscoveryResource } from '../../domain/discovery';
import { draftRelations } from '../universe/model';

export const categoryLabel = (value: string) =>
  value === 'seo' ? 'SEO' : value.replaceAll('-', ' ');

export function ResourceInspector({ selected }: { selected: DiscoveryResource | undefined }) {
  const connections = [
    ...new Set(
      draftRelations
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
        <span className="draft-status">Draft</span>
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
              <dd>Interactive instructions</dd>
            </div>
            <div>
              <dt>Creator</dt>
              <dd>AgentGrid Editorial draft</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>Host testing pending</dd>
            </div>
          </dl>
          {connections.length > 0 && (
            <div className="related-signals">
              <p className="eyebrow">Connected through</p>
              <p>{connections.join(' · ')}</p>
            </div>
          )}
          <p className="inspector-note">
            An unpublished first-party draft. Reuse terms and platform verification are required
            before distribution.
          </p>
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
