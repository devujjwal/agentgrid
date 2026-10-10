'use client';
import { useState, useSyncExternalStore } from 'react';
import { MediaDashboard } from '../../../components/reels/MediaDashboard';
import { PublicationSummarySchema, type MediaOverview } from '../../../domain/media-workspace';
const source = '11111111-1111-4111-8111-111111111111';
const reel = '22222222-2222-4222-8222-222222222222';
const connection = '33333333-3333-4333-8333-333333333333';
const initial: MediaOverview = {
  observedAt: '2026-10-10T10:00:00Z',
  capabilities: { connect: false, render: false, publish: false, schedule: false },
  budget: { limitMicros: 250000, heldMicros: 0, spentMicros: 0 },
  siteBudget: { limitMicros: 5000000, heldMicros: 0, spentMicros: 0 },
  sources: [{ id: source }],
  connections: [
    {
      id: connection,
      platform: 'instagram',
      label: 'Garden Studio — synthetic account',
      expiresAt: '2030-10-10T10:00:00Z',
      publishingEnabled: false,
    },
  ],
  reels: [
    {
      id: reel,
      plan: {
        sourceRunId: source,
        title: 'A small garden, a fresh start',
        narration: 'Start small. Give it light. Grow something today.',
        scenes: [
          {
            seconds: 5,
            visual: 'A terracotta pot on a sunny kitchen windowsill.',
            onScreenText: 'Start small.',
          },
          {
            seconds: 5,
            visual: 'A small herb seedling planted gently in fresh soil.',
            onScreenText: 'Give it light.',
          },
        ],
        format: 'portrait-720p',
      },
      digest: 'a'.repeat(64),
      maximumCostMicros: 10000,
      state: 'queued',
      approvedAt: null,
      asset: null,
    },
  ],
  publications: [],
};
const subscribe = () => () => {};
export function MediaQa() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [overview, setOverview] = useState(initial);
  const [notice, setNotice] = useState('');
  if (!mounted) return <p>Loading local acceptance fixture…</p>;
  return (
    <>
      <p className="media-notice">
        Synthetic local acceptance test. No account sign-in, network provider, charge or social
        post. Allowances are fixtures.
      </p>
      <label className="media-check">
        <input
          type="checkbox"
          checked={overview.capabilities.render}
          onChange={(e) =>
            setOverview({
              ...overview,
              capabilities: {
                connect: e.target.checked,
                render: e.target.checked,
                publish: e.target.checked,
                schedule: e.target.checked,
              },
            })
          }
        />
        Simulate activated controls in this local fixture
      </label>
      {notice && <p role="status">{notice}</p>}
      <MediaDashboard
        overview={overview}
        busy={false}
        onConnect={async (platform) =>
          setNotice(`Synthetic ${platform} sign-in only. No provider opened.`)
        }
        onChange={async (action, body) => {
          const data = body as { id: string };
          setNotice(`Synthetic ${action} recorded. No external request.`);
          if (action === 'enable-connection' || action === 'disable-connection')
            setOverview({
              ...overview,
              connections: overview.connections.map((c) =>
                c.id === data.id ? { ...c, publishingEnabled: action === 'enable-connection' } : c,
              ),
            });
          if (action === 'disconnect')
            setOverview({
              ...overview,
              connections: overview.connections.filter((c) => c.id !== data.id),
            });
          if (action === 'approve-reel' || action === 'cancel-reel')
            setOverview({
              ...overview,
              reels: overview.reels.map((r) =>
                r.id === data.id
                  ? { ...r, state: action === 'approve-reel' ? 'rendering' : 'cancelled' }
                  : r,
              ),
            });
          if (action === 'inspect')
            setOverview({
              ...overview,
              reels: overview.reels.map((r) =>
                r.id === data.id
                  ? {
                      ...r,
                      state: 'ready',
                      asset: { id: crypto.randomUUID(), sha256: 'd'.repeat(64), seconds: 10 },
                    }
                  : r,
              ),
            });
          if (action === 'approve-publication' || action === 'cancel-publication')
            setOverview({
              ...overview,
              publications: overview.publications.map((p) =>
                p.id === data.id
                  ? {
                      ...p,
                      approvedAt: action === 'approve-publication' ? overview.observedAt : null,
                      expiresAt: action === 'approve-publication' ? '2030-10-10T10:00:00Z' : null,
                      deliveries: p.deliveries.map((d) => ({
                        ...d,
                        state: action === 'cancel-publication' ? 'cancelled' : d.state,
                      })),
                    }
                  : p,
              ),
            });
        }}
        onPrepareReel={async (draft, sourceRunId) => {
          setOverview({
            ...overview,
            reels: [
              {
                id: crypto.randomUUID(),
                plan: { ...draft, sourceRunId },
                state: 'queued',
                asset: null,
                approvedAt: null,
                maximumCostMicros: 10000,
                digest: 'b'.repeat(64),
              },
              ...overview.reels,
            ],
          });
          setNotice('Synthetic quote saved. No provider called.');
        }}
        onPreparePublication={async (body) => {
          const publication = PublicationSummarySchema.parse({
            id: crypto.randomUUID(),
            preview: body,
            digest: 'c'.repeat(64),
            approvedAt: null,
            expiresAt: null,
            deliveries: (body as { destinations: { connectionId: string }[] }).destinations.map(
              (d) => ({
                id: crypto.randomUUID(),
                connectionId: d.connectionId,
                state: 'pending',
                canResume: false,
              }),
            ),
          });
          setOverview({ ...overview, publications: [publication, ...overview.publications] });
          return publication;
        }}
      />
    </>
  );
}
