'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIdentity } from '../identity/useIdentity';
import { communityRequest } from '../../services/community';
import {
  ExecutionOverviewSchema,
  StoredRunSchema,
  type ExecutionOverview,
  type StoredRun,
} from '../../domain/execution';
import { RunComposer } from './RunComposer';
import { RunHistory } from './RunHistory';
export function Runner() {
  const session = useIdentity();
  return (
    <section className="identity-panel">
      <h1>Run an agent</h1>
      <p>Prepare a private text run, check its cost cap, then approve generation.</p>
      {session.pending ? (
        <p role="status">Checking your session…</p>
      ) : session.error ? (
        <p role="alert">{session.error}</p>
      ) : session.identity?.signedIn ? (
        <ConnectedRunner csrf={session.identity.csrf} />
      ) : (
        <p>
          <Link href="/sign-in/?next=%2Fworkspace%2Fruns%2F">Sign in to run agents</Link>
        </p>
      )}
      <p>
        <Link href="/workspace/">Back to your workspace</Link>
      </p>
    </section>
  );
}
function ConnectedRunner({ csrf }: { csrf: string }) {
  const [overview, setOverview] = useState<ExecutionOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<StoredRun | null>(null);
  const [composerRevision, setComposerRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest('/api/execution/', ExecutionOverviewSchema, undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setOverview(value);
          setError(null);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Unable to load runs.');
      });
    return () => controller.abort();
  }, [revision]);
  async function mutate(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const run = await communityRequest(path, StoredRunSchema, { csrf, body });
      setRevision((value) => value + 1);
      return run;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update run.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p role="alert">
          {error} <Link href="/workspace/">Check your membership</Link>
        </p>
      )}
      {!overview ? (
        <p role="status">Loading your runs…</p>
      ) : !overview.enabled ? (
        <p role="status">
          Hosted runs are being prepared. Generation will open once provider access and spending
          allowances are configured.
        </p>
      ) : (
        <>
          <p>
            Remaining allowance:{' '}
            {dollars(
              overview.budget.limitMicros -
                overview.budget.spentMicros -
                overview.budget.heldMicros,
            )}{' '}
            · Reserved: {dollars(overview.budget.heldMicros)}. Allowances are managed by AgentGrid.
          </p>
          <RunComposer
            key={composerRevision}
            agents={overview.agents}
            busy={busy}
            prepared={prepared}
            onPrepare={async (body) => {
              setPrepared(await mutate('/api/execution/prepare/', body));
            }}
            onApprove={async () => {
              if (
                prepared &&
                (await mutate('/api/execution/approve/', {
                  id: prepared.id,
                  digest: prepared.digest,
                }))
              ) {
                setPrepared(null);
                setComposerRevision((value) => value + 1);
              }
            }}
            onDiscard={() => setPrepared(null)}
          />
          <RunHistory
            onConfirm={setPrepared}
            runs={overview.runs}
            busy={busy}
            onCancel={(id) => {
              void mutate('/api/execution/cancel/', { id });
            }}
          />
        </>
      )}
      <button
        type="button"
        className="action-secondary"
        disabled={busy}
        onClick={() => setRevision((value) => value + 1)}
      >
        Refresh runs
      </button>
    </>
  );
}
export function dollars(micros: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(micros / 1_000_000);
}
