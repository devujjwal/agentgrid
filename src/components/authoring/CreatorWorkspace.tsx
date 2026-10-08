'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import { newDraft } from '../../domain/draft';
import { useIdentity } from '../identity/useIdentity';
import { useCreatorDraft } from './useCreatorDraft';
import { DraftComposer } from './DraftComposer';
import { blankAgentFields, NewAgentForm, type NewAgentFields } from './NewAgentForm';
import { platformChoices } from './PlatformFields';
import { HeldDraft } from './HeldDraft';
import { useCreatorMemory } from './CreatorMemory';
export function CreatorWorkspace() {
  const identity = useIdentity(),
    params = useSearchParams(),
    router = useRouter(),
    memory = useCreatorMemory();
  const id = params.get('resourceId');
  const valid =
    (id === null || z.uuid().safeParse(id).success) &&
    [...params.keys()].every((key) => key === 'resourceId') &&
    params.getAll('resourceId').length <= 1;
  const editor = useCreatorDraft(identity.identity, valid ? id : null);
  const [entry, setEntry] = useState<{ owner: string; fields: NewAgentFields } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const email = identity.identity?.signedIn ? identity.identity.email : null;
  const fields = entry?.owner === email ? entry.fields : blankAgentFields;
  async function create() {
    setCreateError(null);
    const platform = platformChoices.find((item) => item.value === fields.platform);
    if (!platform) {
      setCreateError('Choose an intended platform.');
      return;
    }
    try {
      const record = await editor.create(
        newDraft(fields.name, fields.slug, fields.category, platform.value),
      );
      if (record) router.replace('/workspace/agent/?resourceId=' + record.resourceId);
    } catch {
      setCreateError(
        'Check the name, category and lowercase resource path before creating a draft.',
      );
    }
  }
  return (
    <>
      {!valid ? (
        <p role="alert">This draft address is invalid. Open the agent from your workspace.</p>
      ) : identity.pending ? (
        <p role="status">Verifying your connection…</p>
      ) : identity.error ? (
        <section className="identity-panel">
          <p role="alert">{identity.error}</p>
          <button className="action-secondary" onClick={identity.reload}>
            Reconnect
          </button>
        </section>
      ) : !identity.identity?.signedIn ? (
        <section className="identity-panel">
          <h2>Bring your own signal.</h2>
          <p>
            {editor.retainedEdits
              ? 'Your unsaved draft is held in this tab. Sign in in another tab, then return here. Identity and ownership are checked again before your edits reappear.'
              : 'Sign in to author a private agent definition.'}
          </p>
          <Link
            prefetch={false}
            className="action-primary"
            target={memory.hasUnsaved ? '_blank' : undefined}
            rel={memory.hasUnsaved ? 'noopener noreferrer' : undefined}
            href={
              '/sign-in/?returnTo=' +
              encodeURIComponent('/workspace/agent/' + (id ? '?resourceId=' + id : ''))
            }
          >
            {editor.retainedEdits ? 'Sign in in another tab' : 'Connect to AgentGrid'}
          </Link>
          {editor.retainedEdits && (
            <button className="draft-text-action" onClick={identity.reload}>
              Check connection again
            </button>
          )}
        </section>
      ) : editor.pending ? (
        <p role="status">Connecting your draft…</p>
      ) : editor.loadError ? (
        <section className="identity-panel">
          <p role="alert">{editor.loadError}</p>
          <button className="action-secondary" onClick={editor.reload}>
            Reload draft
          </button>
        </section>
      ) : !editor.workspace?.profile || editor.workspace.profile.status !== 'active' ? (
        <section className="identity-panel">
          <h2>
            {editor.workspace?.profile
              ? 'Authoring access is restricted.'
              : 'A creator profile is your choice.'}
          </h2>
          <p>
            {editor.workspace?.profile
              ? 'Your account cannot edit agents right now.'
              : 'Your sign-in is verified. Check community registration and its consent requirements in your workspace before creating a profile.'}
          </p>
          <Link prefetch={false} href="/workspace/">
            Open your workspace
          </Link>
        </section>
      ) : (
        <>
          {(editor.error || createError) && (
            <p className="draft-feedback" role="alert">
              {editor.error ?? createError}
              {!id &&
                ' If a creation request was interrupted, check your workspace before trying again.'}
            </p>
          )}
          {editor.message && (
            <p className="draft-feedback" role="status">
              {editor.message}
            </p>
          )}
          {editor.heldResourceId && (
            <HeldDraft resourceId={editor.heldResourceId} discard={editor.discard} />
          )}
          {!id && !editor.heldResourceId && (
            <NewAgentForm
              fields={fields}
              change={(fields) => {
                if (email) setEntry({ owner: email, fields });
              }}
              busy={editor.busy}
              create={() => void create()}
            />
          )}
          {editor.buffer && (
            <>
              <Link
                prefetch={false}
                className="draft-history-link"
                href={'/workspace/versions/?resourceId=' + editor.buffer.record.resourceId}
              >
                Versions and review history <span aria-hidden="true">↗</span>
              </Link>
              {editor.buffer.conflict && (
                <section className="draft-conflict">
                  <h2>This draft changed elsewhere.</h2>
                  <p>
                    Your unsaved edits are retained in memory. Download the private definition and
                    guide before replacing them if needed. Reloading discards these edits and loads
                    the current saved draft.
                  </p>
                  <button
                    type="button"
                    className="action-secondary"
                    onClick={() => {
                      if (window.confirm('Discard these unsaved edits and reload the saved draft?'))
                        editor.discard();
                    }}
                  >
                    Discard edits and reload
                  </button>
                </section>
              )}
              <DraftComposer
                value={editor.buffer.value}
                change={editor.change}
                editorial={editor.buffer.editorial}
                changeEditorial={editor.changeEditorial}
                sourceVersionId={editor.buffer.record.sourceVersionId}
                revision={editor.buffer.record.revision}
                dirty={editor.buffer.dirty}
                busy={editor.busy}
                readOnly={editor.buffer.conflict || editor.buffer.record.status !== 'active'}
                save={() => void editor.save()}
                section={editor.section}
                changeSection={editor.setSection}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
