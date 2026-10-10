'use client';
import type { StoredRun } from '../../domain/execution';
export function RunHistory({
  runs,
  busy,
  onCancel,
  onConfirm,
}: {
  runs: StoredRun[];
  busy: boolean;
  onCancel: (id: string) => void;
  onConfirm: (run: StoredRun) => void;
}) {
  return (
    <section aria-labelledby="run-history">
      <h2 id="run-history">Your recent runs</h2>
      {!runs.length && <p>Your saved runs will appear here.</p>}
      {runs.map((run) => (
        <article className="run-card" key={run.id}>
          <h3>Run {run.id.slice(0, 8)}</h3>
          <p role="status">{run.state}</p>
          <details>
            <summary>Input</summary>
            <pre className="run-output">{run.input}</pre>
          </details>
          {run.output && <pre className="run-output">{run.output}</pre>}
          {run.state === 'queued' && (
            <p>
              Prepared runs wait for your confirmation and a spending allowance. Refresh to check
              progress.
            </p>
          )}
          {run.state === 'queued' && (
            <button className="action-primary" disabled={busy} onClick={() => onConfirm(run)}>
              Review and confirm
            </button>
          )}
          {run.state === 'blocked' && (
            <p>
              This run could not reserve a spending allowance. Check your remaining allowance and
              any held charges before preparing a new run.
            </p>
          )}
          {run.state === 'uncertain' && (
            <p>
              The provider outcome needs review. Its spending reservation remains held; this run
              will not be retried automatically.
            </p>
          )}
          {run.state === 'cancelled' && (
            <p>
              Output has been discarded. If generation had started, its cost still needs settlement.
            </p>
          )}
          {['queued', 'running', 'uncertain'].includes(run.state) && (
            <button className="action-secondary" disabled={busy} onClick={() => onCancel(run.id)}>
              Cancel this run
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
