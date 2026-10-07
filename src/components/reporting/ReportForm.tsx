'use client';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useIdentity } from '../identity/useIdentity';
import { useCreatorMemory } from '../authoring/CreatorMemory';
import { useReportSubmission } from './useReportSubmission';
import type { ReportInput } from '../../domain/reports';

import { reportCategoryLabels } from './categories';

export function ReportForm({
  targetId,
  targetKind,
  label,
  path,
}: {
  targetId: string;
  targetKind: ReportInput['targetKind'];
  label: string;
  path: string;
}) {
  const identity = useIdentity(),
    memory = useCreatorMemory(),
    submission = useReportSubmission(identity.identity, targetId, targetKind);
  const [permission, setPermission] = useState<string | null>(null);
  const permissionKey = identity.identity?.signedIn
    ? identity.identity.email + ':' + targetKind + ':' + targetId
    : null;
  const approved = permissionKey !== null && permission === permissionKey;
  const fieldKey = targetKind + '-' + targetId;
  const buffer = memory.reportEdits;
  const owned = identity.identity?.signedIn && buffer?.email === identity.identity.email;
  const matching =
    owned && buffer.input.targetId === targetId && buffer.input.targetKind === targetKind;
  const fields: ReportInput = matching
    ? buffer.input
    : { targetId, targetKind, category: 'other', explanation: '' };
  function change(value: ReportInput) {
    if (identity.identity?.signedIn)
      memory.setReportEdits({ email: identity.identity.email, input: value, path, label });
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!approved) return;
    if (await submission.submit(fields)) {
      memory.setReportEdits(null);
      setPermission(null);
    }
  }
  if (identity.pending || submission.pending)
    return <p role="status">Verifying private reporting access…</p>;
  if (identity.error || submission.error)
    return (
      <>
        <p role="alert">{identity.error ?? submission.error}</p>
        <button
          className="action-secondary"
          onClick={() => (identity.error ? identity.reload() : submission.reload())}
        >
          Reconnect
        </button>
      </>
    );
  if (!identity.identity?.signedIn)
    return (
      <>
        <p>Sign in to send a private report and track its status.</p>
        <Link
          prefetch={false}
          className="action-secondary"
          target="_blank"
          rel="noopener noreferrer"
          href={'/sign-in/?returnTo=' + encodeURIComponent(path)}
        >
          Sign in in another tab
        </Link>
        <p>Return here after signing in.</p>
      </>
    );
  if (!submission.workspace?.profile)
    return (
      <>
        <p>Join the AgentGrid community before reporting.</p>
        <Link prefetch={false} href="/workspace/" className="action-secondary">
          Open your workspace
        </Link>
      </>
    );
  if (submission.workspace.profile.status !== 'active')
    return (
      <p role="alert">
        Reporting is unavailable while your profile is {submission.workspace.profile.status}.
      </p>
    );
  if (owned && !matching && buffer.input.explanation)
    return (
      <>
        <p>Another report is held in this tab. Finish it before replacing its details.</p>
        <Link prefetch={false} href={buffer.path}>
          Return to {buffer.label}
        </Link>
        <button
          className="action-secondary"
          onClick={() => {
            if (window.confirm('Discard the unsent report held in this tab?'))
              memory.setReportEdits(null);
          }}
        >
          Discard held report
        </button>
      </>
    );
  if (submission.feedback?.report)
    return (
      <div role="status">
        <h3>Report received.</h3>
        <p>
          Current status: {submission.feedback.report.state}. Receipt:{' '}
          <code>{submission.feedback.report.id}</code>.
        </p>
        <Link prefetch={false} href="/workspace/reports/" className="action-secondary">
          View your reports
        </Link>
      </div>
    );
  return (
    <form
      className="report-form"
      onSubmit={(event) => void send(event)}
      aria-busy={submission.busy}
    >
      <h3>Report a concern about {label}</h3>
      <p id={'report-privacy-' + fieldKey}>
        Only you and authorized AgentGrid staff can read report details. Leave out passwords, tokens
        and unrelated personal information.
      </p>
      <label htmlFor={'report-category-' + fieldKey}>Concern category</label>
      <select
        id={'report-category-' + fieldKey}
        value={fields.category}
        disabled={submission.busy}
        onChange={(event) =>
          change({ ...fields, category: event.target.value as ReportInput['category'] })
        }
      >
        {Object.entries(reportCategoryLabels).map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <label htmlFor={'report-detail-' + fieldKey}>What happened, and where?</label>
      <textarea
        id={'report-detail-' + fieldKey}
        aria-describedby={'report-privacy-' + fieldKey + ' report-length-' + fieldKey}
        rows={6}
        required
        minLength={40}
        maxLength={2400}
        value={fields.explanation}
        disabled={submission.busy}
        onChange={(event) => change({ ...fields, explanation: event.target.value })}
      />
      <p id={'report-length-' + fieldKey}>
        {fields.explanation.length} / 2,400 characters · at least 40
      </p>
      <label className="report-permission">
        <input
          type="checkbox"
          checked={approved}
          required
          disabled={submission.busy}
          onChange={(event) => setPermission(event.target.checked ? permissionKey : null)}
        />
        I can share these details with AgentGrid moderators.
      </label>
      <button
        className="action-primary"
        disabled={submission.busy || !approved || fields.explanation.trim().length < 40}
      >
        {submission.busy ? 'Sending…' : 'Send private report'}
      </button>
      {submission.feedback?.error && <p role="alert">{submission.feedback.error}</p>}
      <Link prefetch={false} href="/workspace/reports/">
        Check your existing reports
      </Link>
    </form>
  );
}
