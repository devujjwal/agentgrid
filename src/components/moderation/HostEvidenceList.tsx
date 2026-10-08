'use client';
import { useState, useEffect, useRef } from 'react';
import {
  HostRunReceiptSchema,
  type HostRunReceipt,
  type HostRunSummary,
} from '../../domain/host-verification';
import { communityRequest } from '../../services/community';
export function HostEvidenceList({ runs }: { runs: HostRunSummary[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    id: string;
    record: HostRunReceipt | null;
    error: string | null;
  } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void communityRequest(
      '/api/moderation/host-record/?recordId=' + selected,
      HostRunReceiptSchema,
      undefined,
      controller.signal,
    ).then(
      (record) => {
        if (!controller.signal.aborted)
          setSnapshot({
            id: selected,
            record: record.id === selected ? record : null,
            error: record.id === selected ? null : 'Evidence record did not match.',
          });
      },
      () => {
        if (!controller.signal.aborted)
          setSnapshot({
            id: selected,
            record: null,
            error:
              'Evidence could not be read. Close this record and recheck staff access before trying again.',
          });
      },
    );
    return () => controller.abort();
  }, [selected]);
  const loaded = snapshot?.id === selected ? snapshot : null,
    current = loaded?.record;
  useEffect(() => {
    if (selected && loaded) heading.current?.focus();
  }, [selected, loaded]);
  return (
    <section aria-labelledby="host-history-title">
      <h3 id="host-history-title">Recorded observations</h3>
      {runs.length === 0 ? (
        <p>No host observations are recorded for this version.</p>
      ) : (
        <ul className="moderation-rows">
          {runs.map((receipt) => (
            <li key={receipt.id}>
              <div>
                <strong>
                  {receipt.platform} · {receipt.scenario}
                </strong>
                <p>
                  {receipt.completedOn} / {receipt.failedChecks} failed{' '}
                  {receipt.failedChecks === 1 ? 'check' : 'checks'}
                </p>
              </div>
              <button
                className="action-secondary"
                aria-expanded={selected === receipt.id}
                onClick={(event) => {
                  trigger.current = event.currentTarget;
                  setSelected(selected === receipt.id ? null : receipt.id);
                }}
              >
                Inspect record {runs.indexOf(receipt) + 1}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && !loaded && <p role="status">Loading the selected private observation…</p>}
      {loaded?.error && <p role="alert">{loaded.error}</p>}
      {selected && (
        <button
          className="action-secondary"
          onClick={() => {
            setSelected(null);
            trigger.current?.focus();
          }}
        >
          Close evidence record
        </button>
      )}
      {current && (
        <article className="moderation-existing">
          <h4 ref={heading} tabIndex={-1}>
            {current.run.host_version}
          </h4>
          <p className="moderation-prose">Record {current.id}</p>
          <h4>Redacted input</h4>
          <p className="moderation-prose">{current.run.input}</p>
          <h4>Observed output</h4>
          <p className="moderation-prose">{current.run.observed_output}</p>
          <h4>Checked assertions</h4>
          <ul>
            {current.run.assertions.map((check, index) => (
              <li key={index} className="moderation-prose">
                {check.passed ? 'Passed' : 'Failed'} — {check.description}
              </li>
            ))}
          </ul>
          <h4>Reviewer notes</h4>
          <p className="moderation-prose">{current.run.reviewer_notes}</p>
        </article>
      )}
    </section>
  );
}
