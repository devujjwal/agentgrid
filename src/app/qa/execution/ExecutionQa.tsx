'use client';
import { useState } from 'react';
import { RunComposer } from '../../../components/execution/RunComposer';
import { RunHistory } from '../../../components/execution/RunHistory';
import type { StoredRun } from '../../../domain/execution';
const versionId = '30000000-0000-4000-8000-000000000001';
const base: StoredRun = {
  id: '40000000-0000-4000-8000-000000000001',
  ownerId: '10000000-0000-4000-8000-000000000001',
  versionId,
  idempotencyKey: '50000000-0000-4000-8000-000000000001',
  providerIdentity: 'Synthetic QA model',
  instructions:
    'Create a concise reel script from the supplied brief. No real media or social posting.',
  input: 'Synthetic brief',
  digest: 'a'.repeat(64),
  maximumCostMicros: 5000,
  approved: false,
  state: 'queued',
  output: null,
};
export function ExecutionQa() {
  const [prepared, setPrepared] = useState<StoredRun | null>(null);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  return (
    <>
      <p>Remaining allowance: $0.0200 · Reserved: $0.0000</p>
      <RunComposer
        agents={[{ versionId, name: 'Synthetic reel script planner' }]}
        busy={false}
        prepared={prepared}
        onPrepare={async (body) => {
          const run = { ...base, ...body };
          setPrepared(run);
          setRuns([run]);
        }}
        onApprove={async () => {
          if (prepared) {
            setRuns([
              {
                ...prepared,
                approved: true,
                state: 'succeeded',
                output:
                  'Synthetic output: Hook → scene outline → call to action. This is a UI fixture.',
              },
            ]);
            setPrepared(null);
          }
        }}
        onDiscard={() => setPrepared(null)}
      />
      <RunHistory
        runs={runs}
        busy={false}
        onConfirm={setPrepared}
        onCancel={(id) =>
          setRuns((value) =>
            value.map((run) =>
              run.id === id ? { ...run, state: 'cancelled', output: null } : run,
            ),
          )
        }
      />
    </>
  );
}
