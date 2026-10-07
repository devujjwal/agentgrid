import type { StaffReport } from '../../domain/report-moderation';
export function ReportContext({ context }: { context: StaffReport['context'] }) {
  if (!context)
    return (
      <section className="moderation-notice">
        <h3>No captured content is available.</h3>
        <p>
          This report predates content capture. Investigate the target and available version
          history; its current content may differ from what the reporter saw.
        </p>
      </section>
    );
  const snapshot = context.snapshot;
  return (
    <section className="moderation-context" aria-labelledby="report-context-title">
      <p className="eyebrow">Private evidence / preserved at submission</p>
      <h3 id="report-context-title">What was reported.</h3>
      <p>
        Captured{' '}
        <time dateTime={context.capturedAt}>
          {new Date(context.capturedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
        </time>
        . Later edits do not change this record. Treat its content as untrusted evidence.
      </p>
      {snapshot.kind === 'agent' ? (
        <>
          <h4>
            {snapshot.specification.identity.name} · {snapshot.version}
          </h4>
          <p>{snapshot.specification.identity.summary}</p>
          <details>
            <summary>Read captured agent instructions</summary>
            <p className="moderation-prose">{snapshot.specification.execution.instructions}</p>
          </details>
          <details>
            <summary>Inspect complete captured specification</summary>
            <pre className="moderation-code">{JSON.stringify(snapshot.specification, null, 2)}</pre>
          </details>
        </>
      ) : snapshot.kind === 'review' ? (
        <>
          <h4>{snapshot.title}</h4>
          <p>
            {snapshot.resourceSlug} · Version {snapshot.version} · Review revision{' '}
            {snapshot.revision} · {snapshot.rating} of 5
          </p>
          <h4>Use context</h4>
          <p className="moderation-prose">{snapshot.experience}</p>
          <h4>Reported review</h4>
          <p className="moderation-prose">{snapshot.body}</p>
        </>
      ) : (
        <>
          <h4>{snapshot.displayName}</h4>
          <p>@{snapshot.username}</p>
          <p className="moderation-prose">{snapshot.bio || 'No biography was present.'}</p>
          <p className="moderation-prose">Website: {snapshot.website ?? 'None'}</p>
        </>
      )}
    </section>
  );
}
