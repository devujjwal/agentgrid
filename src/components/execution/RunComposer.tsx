'use client';
import { useState } from 'react';
import type { StoredRun, ExecutionOverview } from '../../domain/execution';
import { dollars } from './Runner';
export function RunComposer({
  agents,
  busy,
  prepared,
  onPrepare,
  onApprove,
  onDiscard,
}: {
  agents: ExecutionOverview['agents'];
  busy: boolean;
  prepared: StoredRun | null;
  onPrepare: (body: { versionId: string; idempotencyKey: string; input: string }) => Promise<void>;
  onApprove: () => Promise<void>;
  onDiscard: () => void;
}) {
  const [input, setInput] = useState('');
  const [version, setVersion] = useState('');
  // Keep the same key on network retries; changing input starts a new request.
  const [key, setKey] = useState<string | null>(null);
  if (prepared)
    return (
      <div className="run-card">
        <h2>Confirm this run</h2>
        <p>
          Provider: {prepared.providerIdentity}. Maximum estimated cost:{' '}
          {dollars(prepared.maximumCostMicros)}.
        </p>
        <p>
          Your input and this agent’s instructions will be sent to OpenAI to generate text. Avoid
          sensitive personal information. This does not post to social media.
        </p>
        <h3>Your input</h3>
        <pre className="run-output">{prepared.input}</pre>
        <details>
          <summary>Agent instructions</summary>
          <pre className="run-output">{prepared.instructions}</pre>
        </details>
        <button className="action-primary" disabled={busy} onClick={() => void onApprove()}>
          Approve and generate
        </button>{' '}
        <button className="action-secondary" disabled={busy} onClick={onDiscard}>
          Back to editing
        </button>
      </div>
    );
  if (!agents.length)
    return (
      <p>
        No agents are currently approved for hosted execution. You can still browse and use their
        published packages.
      </p>
    );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const id = key ?? crypto.randomUUID();
        setKey(id);
        void onPrepare({ versionId: version || agents[0]!.versionId, idempotencyKey: id, input });
      }}
    >
      <label htmlFor="run-agent">Agent</label>
      <select
        id="run-agent"
        value={version || agents[0]!.versionId}
        disabled={busy}
        onChange={(event) => {
          setVersion(event.target.value);
          setKey(null);
        }}
      >
        {agents.map((agent) => (
          <option key={agent.versionId} value={agent.versionId}>
            {agent.name}
          </option>
        ))}
      </select>
      <label htmlFor="run-input">What should the agent work on?</label>
      <textarea
        id="run-input"
        rows={8}
        required
        maxLength={12000}
        value={input}
        disabled={busy}
        onChange={(event) => {
          setInput(event.target.value);
          setKey(null);
        }}
      />
      <p>
        {input.length.toLocaleString()} / 12,000 characters. Preparing a run does not call the
        model.
      </p>
      <button className="action-primary" disabled={busy || !input.trim()}>
        {busy ? 'Preparing…' : 'Prepare run'}
      </button>
    </form>
  );
}
