'use client';
import { useState } from 'react';
import { newDraft, parseDraftSpecification } from '../../domain/draft';
import { DraftComposer } from './DraftComposer';
/** Local presentation acceptance only. No session, provider, database or network. */
export function AuthoringQa() {
  const [value, setValue] = useState(() =>
    newDraft('Synthetic meal planning resource', 'synthetic-meal-planning', 'everyday', 'chatgpt'),
  );
  const [revision, setRevision] = useState(1),
    [dirty, setDirty] = useState(false),
    [section, setSection] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  function save() {
    try {
      parseDraftSpecification(value);
      setRevision((current) => current + 1);
      setDirty(false);
      setMessage(
        'Synthetic memory-only acknowledgement. No database save or publication occurred.',
      );
    } catch {
      setMessage('Synthetic draft validation refused the current definition.');
    }
  }
  return (
    <section className="workspace-layout creator-layout">
      <h2>Local authoring acceptance</h2>
      <p>
        Clearly synthetic, disposable UI state. This fixture makes no community requests and creates
        no real agent, account, review or activity.
      </p>
      {message && <p role="status">{message}</p>}
      <DraftComposer
        value={value}
        change={(next) => {
          setValue(next);
          setDirty(true);
        }}
        sourceVersionId={null}
        revision={revision}
        dirty={dirty}
        busy={false}
        save={save}
        section={section}
        changeSection={setSection}
      />
    </section>
  );
}
