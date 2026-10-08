'use client';
import { useEffect, useState } from 'react';
import type { IdentityResponse } from '../../domain/session';
import { OwnedVersionDocumentSchema, type OwnedVersionDocument } from '../../domain/versions';
import { communityRequest } from '../../services/community';

export function VersionSnapshot({
  connection,
  resourceId,
  versionId,
}: {
  connection: IdentityResponse;
  resourceId: string;
  versionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    connection: IdentityResponse;
    resourceId: string;
    versionId: string;
    document: OwnedVersionDocument | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (open && connection.signedIn)
      void communityRequest(
        '/api/workspace/version/?resourceId=' + resourceId + '&versionId=' + versionId,
        OwnedVersionDocumentSchema,
        undefined,
        controller.signal,
      )
        .then((document) => {
          if (document.resourceId !== resourceId || document.record.id !== versionId)
            throw new Error('The frozen definition could not be confirmed.');
          if (!controller.signal.aborted)
            setSnapshot({ connection, resourceId, versionId, document, error: null });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              connection,
              resourceId,
              versionId,
              document: null,
              error:
                error instanceof Error ? error.message : 'The frozen definition is unavailable.',
            });
        });
    return () => controller.abort();
  }, [connection, resourceId, versionId, open]);
  const current =
    snapshot?.connection === connection &&
    snapshot.resourceId === resourceId &&
    snapshot.versionId === versionId
      ? snapshot
      : null;
  const document = current?.document;
  const panelId = 'version-snapshot-' + versionId;
  function download() {
    if (!document) return;
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2) + '\n'], { type: 'application/json' }),
    );
    const anchor = window.document.createElement('a');
    anchor.href = href;
    anchor.download =
      document.specification.identity.slug +
      '.' +
      document.record.version +
      '.private-version.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <div className="version-snapshot">
      <button
        type="button"
        className="action-secondary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setSnapshot(null);
          setOpen((value) => !value);
        }}
      >
        {open ? 'Close frozen definition' : 'Inspect frozen definition'}
      </button>
      <section id={panelId} aria-label="Private frozen definition" hidden={!open}>
        {open && (
          <>
            {!current && <p role="status">Loading the owned immutable definition…</p>}
            {current?.error && <p role="alert">{current.error}</p>}
            {document && (
              <>
                <h4>Frozen definition / {document.record.version}</h4>
                <p>{document.specification.identity.summary}</p>
                <p>
                  This private snapshot includes the submitted definition, author guide and source
                  version reference. It excludes staff evidence and publication manifests. Exporting
                  it does not publish it or establish platform compatibility.
                </p>
                <details>
                  <summary>Read the frozen JSON</summary>
                  <pre tabIndex={0} aria-label="Frozen submitted JSON">
                    {JSON.stringify(document, null, 2)}
                  </pre>
                </details>
                <button type="button" className="action-secondary" onClick={download}>
                  Download private version snapshot
                </button>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
