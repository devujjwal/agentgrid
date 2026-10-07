'use client';
import Link from 'next/link';
import type { SavedList as SavedListData } from '../../domain/saves';
import { AgentGlyph } from '../universe/AgentGlyph';
import { categoryLabel } from '../discovery/ResourceInspector';

export function SavedList({
  list,
  busy,
  remove,
  offset,
  changeOffset,
}: {
  list: SavedListData;
  busy: boolean;
  remove: (id: string) => void;
  offset: number;
  changeOffset: (offset: number) => void;
}) {
  if (!list.agents.length)
    return (
      <section className="saved-empty">
        <p className="eyebrow">A place for useful connections</p>
        <h2>Your orbit starts with an agent.</h2>
        <p>
          Save resources that help with your work or everyday plans. Your list stays private and
          travels with your account.
        </p>
        <Link prefetch={false} href="/agents/" className="action-primary">
          Discover agents <span aria-hidden="true">↗</span>
        </Link>
      </section>
    );
  return (
    <>
      <ul className="saved-list" aria-label="Your saved agents">
        {list.agents.map((item) => (
          <li key={item.resourceId}>
            <svg className="saved-glyph" viewBox="-48 -48 96 96" aria-hidden="true">
              {item.resource ? <AgentGlyph category={item.resource.category} /> : <circle r="24" />}
            </svg>
            <div className="saved-resource">
              <p className="eyebrow">
                {item.resource ? categoryLabel(item.resource.category) : 'Connection unavailable'}
              </p>
              <h2>
                {item.resource ? (
                  <Link prefetch={false} href={'/agents/' + item.resource.slug + '/'}>
                    {item.resource.title}
                  </Link>
                ) : (
                  'Previously saved agent'
                )}
              </h2>
              <p>
                {item.resource?.summary ??
                  'This resource is no longer available. Its private content is hidden; you can remove it from your list.'}
              </p>
              <p className="saved-date">
                Saved <time dateTime={item.savedAt}>{item.savedAt.slice(0, 10)}</time>
              </p>
            </div>
            <button
              type="button"
              className="action-secondary"
              disabled={busy}
              onClick={() => remove(item.resourceId)}
              aria-label={
                'Remove ' + (item.resource?.title ?? 'unavailable agent') + ' from saved agents'
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {(offset > 0 || list.hasMore) && (
        <nav className="saved-pagination" aria-label="Saved agents pages">
          <button
            className="action-secondary"
            disabled={busy || offset === 0}
            onClick={() => changeOffset(Math.max(0, offset - 20))}
          >
            Previous
          </button>
          <span>Page {Math.floor(offset / 20) + 1}</span>
          <button
            className="action-secondary"
            disabled={busy || !list.hasMore || offset + 20 > 9999}
            onClick={() => changeOffset(offset + 20)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
