'use client';
import {
  ResourceDecisionSchema,
  type ResourceDecision,
  type StaffResource,
} from '../../domain/resource-moderation';
import { ConfirmAction } from '../feedback/ConfirmAction';
export function ResourceDecisionForm({
  resource,
  explanation,
  changeNotes,
  busy,
  uncertain,
  submit,
}: {
  resource: StaffResource;
  explanation: string;
  changeNotes: (value: string) => void;
  busy: boolean;
  uncertain: boolean;
  submit: (value: ResourceDecision) => void;
}) {
  const decision = resource.status === 'blocked' ? 'active' : 'blocked';
  const unavailable =
    resource.status === 'archived' ||
    resource.ownerIsSelf ||
    (decision === 'active' && resource.ownerStatus !== 'active');
  const parsed = ResourceDecisionSchema.safeParse({
    resourceId: resource.resourceId,
    expectedRevision: resource.revision,
    expectedReleaseId: resource.releasedVersionId,
    decision,
    explanation,
  });
  return (
    <section className="moderation-decision" aria-labelledby="resource-decision-title">
      <p className="eyebrow">Resource access / recorded decision</p>
      <h2 id="resource-decision-title">
        {decision === 'blocked' ? 'Restrict this agent.' : 'Restore live access.'}
      </h2>
      <p>
        Blocking removes this agent from live community access, including new saves, reviews and
        forks. Restoration preserves its release history and does not approve an unpublished
        version.
      </p>
      <aside className="moderation-notice">
        <strong>Published pages need a separate check.</strong>
        <p>
          This decision changes live access. It does not confirm removal or restoration of static
          pages, search results or downloaded copies. Follow the publishing takedown process before
          closing a related report.
        </p>
      </aside>
      {resource.ownerIsSelf && (
        <p role="alert">An uninvolved moderator must decide access to your own agent.</p>
      )}
      {resource.status === 'archived' && (
        <p role="status">Archived agents cannot be restored through this control.</p>
      )}
      {decision === 'active' && resource.ownerStatus !== 'active' && (
        <p role="status">
          The owner must have an active account before this agent can be restored.
        </p>
      )}
      <fieldset className="moderation-fields" disabled={busy || uncertain || unavailable}>
        <legend>Staff decision record</legend>
        <label htmlFor="resource-decision-notes">Reason for this decision</label>
        <textarea
          id="resource-decision-notes"
          rows={5}
          minLength={20}
          maxLength={2400}
          value={explanation}
          aria-describedby="resource-decision-help"
          onChange={(event) => changeNotes(event.target.value)}
        />
        <p id="resource-decision-help">
          20–2,400 characters. State the issue and the evidence supporting your decision. Keep
          personal information and credentials out of the record.
        </p>
      </fieldset>
      <ConfirmAction
        label={
          busy
            ? 'Recording decision…'
            : decision === 'blocked'
              ? 'Review block decision'
              : 'Review restoration'
        }
        title={
          decision === 'blocked'
            ? 'Block this agent’s live access?'
            : 'Restore this agent’s live access?'
        }
        description={`This records an immutable staff audit entry for ${resource.slug}, status revision ${resource.revision}. It does not complete the separate static publishing check.`}
        confirmation={decision === 'blocked' ? 'Block live access' : 'Restore live access'}
        disabled={busy || uncertain || unavailable || !parsed.success}
        confirm={() => {
          if (parsed.success) submit(parsed.data);
        }}
      />
    </section>
  );
}
