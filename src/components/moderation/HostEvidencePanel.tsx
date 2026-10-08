'use client';
import type { StaffSubmission } from '../../domain/submission-moderation';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { HostEvidenceForm } from './HostEvidenceForm';
import { HostEvidenceList } from './HostEvidenceList';
import { useHostEvidence } from './useHostEvidence';
export default function HostEvidencePanel({
  submission,
  email,
  csrf,
}: {
  submission: StaffSubmission;
  email: string;
  csrf: string;
}) {
  const {
    memory,
    setRetry,
    busy,
    uncertain,
    attested,
    setAttested,
    message,
    setMessage,
    error,
    setError,
    current,
    held,
    buffer,
    empty,
    record,
    alreadyRecorded,
  } = useHostEvidence(submission, email, csrf);
  return (
    <section
      className="moderation-context"
      aria-labelledby="host-evidence-title"
      aria-busy={busy || !current}
    >
      <h3 id="host-evidence-title">Host verification evidence</h3>
      <p>
        Private observations belong to version {submission.version}. They are separate from
        illustrative examples, author declarations and the final publication decision.
      </p>
      <button
        className="action-secondary"
        disabled={busy || !current}
        onClick={() => {
          setError(null);
          setMessage(null);
          setAttested(false);
          setRetry((value) => value + 1);
        }}
      >
        Check recorded evidence
      </button>
      {!current && <p role="status">Checking the immutable definition and private observations…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {current && !current.error && (
        <>
          <HostEvidenceList runs={current.runs} />
          {held && !buffer ? (
            <div className="moderation-notice">
              <p>
                An unsaved observation for another version is held in this tab. Return to that
                version to keep working, or deliberately discard it.
              </p>
              <ConfirmAction
                label="Discard other observation"
                title="Discard the held observation?"
                description="Only the unsaved observation in this tab will be discarded. Recorded evidence remains unchanged."
                confirmation="Discard unsaved observation"
                confirm={() => memory.setHostEvidence(null)}
              />
            </div>
          ) : alreadyRecorded ? (
            <div className="moderation-notice">
              <p role="status">
                A record with this request reference is present. Inspect it before starting another
                observation.
              </p>
              <button
                className="action-secondary"
                onClick={() => {
                  memory.setHostEvidence(null);
                  setAttested(false);
                }}
              >
                Start another observation
              </button>
            </div>
          ) : (
            <HostEvidenceForm
              value={buffer?.run ?? empty}
              platforms={current.platforms}
              change={(run) => {
                memory.setHostEvidence({
                  email,
                  versionId: submission.versionId,
                  recordId: crypto.randomUUID(),
                  run,
                });
                setAttested(false);
              }}
              disabled={
                busy ||
                uncertain ||
                current.runs.length >= 60 ||
                submission.state !== 'pending' ||
                submission.resourceStatus !== 'active' ||
                submission.authorStatus !== 'active'
              }
              attested={attested}
              setAttested={setAttested}
              record={() => void record()}
            />
          )}
          {submission.state !== 'pending' && (
            <p role="status">
              This submission is {submission.state}. New observations require a pending version.
            </p>
          )}
          {current.runs.length >= 60 && (
            <p role="status">
              This version has reached its 60-record evidence limit. Review the existing
              observations before preparing another version.
            </p>
          )}
        </>
      )}
    </section>
  );
}
