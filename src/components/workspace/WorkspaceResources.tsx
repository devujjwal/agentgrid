import type { WorkspaceList } from '../../domain/workspace';
import Link from 'next/link';
export function WorkspaceResources({
  list,
  pending,
  offset,
  changeOffset,
}: {
  list: WorkspaceList | null;
  pending: boolean;
  offset: number;
  changeOffset: (offset: number) => void;
}) {
  return (
    <section className="workspace-resources">
      <p className="eyebrow">Your agents / work in progress</p>
      <h2>Signals you’re building.</h2>
      <Link prefetch={false} href="/workspace/agent/" className="action-secondary">
        Create an agent <span aria-hidden="true">+</span>
      </Link>
      {list?.agents.length === 0 && (
        <div className="workspace-empty">
          <p>No agents yet.</p>
          <p>
            Your drafts and submitted versions will appear here. Start with a useful task and clear
            instructions.
          </p>
        </div>
      )}
      {list && list.agents.length > 0 && (
        <ul>
          {list.agents.map((agent) => (
            <li key={agent.id}>
              <Link prefetch={false} href={'/workspace/agent/?resourceId=' + agent.id}>
                <strong>{agent.slug}</strong>
              </Link>
              <span>{agent.status}</span>
            </li>
          ))}
        </ul>
      )}
      {list && (offset > 0 || list.hasMore) && (
        <nav aria-label="Your agent pages">
          <button
            type="button"
            className="action-secondary"
            disabled={pending || offset === 0}
            onClick={() => changeOffset(Math.max(0, offset - 20))}
          >
            Previous
          </button>
          <button
            type="button"
            className="action-secondary"
            disabled={pending || !list.hasMore}
            onClick={() => changeOffset(offset + 20)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
