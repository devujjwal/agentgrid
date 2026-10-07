'use client';
import { useEffect, useRef, useState } from 'react';
import type { IdentityResponse } from '../../domain/session';
import { DraftRecordSchema, type DraftRecord } from '../../domain/draft';
import { OwnedVersionSchema, OwnedVersionsSchema, type OwnedVersions } from '../../domain/versions';
import { communityRequest } from '../../services/community';

export function useCreatorVersions(connection: IdentityResponse | null, resourceId: string | null) {
  const [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<{
    connection: IdentityResponse | null;
    id: string | null;
    offset: number;
    retry: number;
    draft: DraftRecord | null;
    history: OwnedVersions | null;
    error: string | null;
  }>({
    connection: null,
    id: null,
    offset: -1,
    retry: -1,
    draft: null,
    history: null,
    error: null,
  });
  const [feedback, setFeedback] = useState<{
    connection: IdentityResponse;
    id: string;
    message: string;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (connection?.signedIn && resourceId)
      void Promise.all([
        communityRequest(
          '/api/workspace/draft/?resourceId=' + resourceId,
          DraftRecordSchema,
          undefined,
          controller.signal,
        ),
        communityRequest(
          '/api/workspace/versions/?resourceId=' + resourceId + '&offset=' + offset,
          OwnedVersionsSchema,
          undefined,
          controller.signal,
        ),
      ])
        .then(([draft, history]) => {
          if (!controller.signal.aborted)
            setSnapshot({ connection, id: resourceId, offset, retry, draft, history, error: null });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              connection,
              id: resourceId,
              offset,
              retry,
              draft: null,
              history: null,
              error: error instanceof Error ? error.message : 'Version history is unavailable.',
            });
        });
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, [connection, resourceId, offset, retry]);
  const ready =
    connection?.signedIn &&
    resourceId &&
    snapshot.connection === connection &&
    snapshot.id === resourceId &&
    snapshot.offset === offset &&
    snapshot.retry === retry;
  const refresh = () => setRetry((value) => value + 1);
  async function mutate(path: string, body: unknown) {
    if (!ready || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await communityRequest(
        path,
        OwnedVersionSchema,
        { csrf: connection.csrf, body },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setFeedback({
        connection,
        id: resourceId,
        message:
          result.state === 'withdrawn'
            ? 'Review request withdrawn. The frozen version remains in your history.'
            : 'Version ' + result.version + ' submitted for review. It is not published.',
        failed: false,
      });
      refresh();
    } catch (error) {
      if (!controller.signal.aborted)
        setFeedback({
          connection,
          id: resourceId,
          message:
            error instanceof Error
              ? error.message
              : 'The request could not be confirmed. Check history before retrying.',
          failed: true,
        });
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return {
    draft: ready ? snapshot.draft : null,
    history: ready ? snapshot.history : null,
    error: ready ? snapshot.error : null,
    pending: Boolean(connection?.signedIn && resourceId && !ready),
    feedback: feedback?.connection === connection && feedback.id === resourceId ? feedback : null,
    busy,
    offset,
    changeOffset: setOffset,
    refresh,
    submit: () =>
      snapshot.draft &&
      mutate('/api/workspace/submit/', { resourceId, expectedRevision: snapshot.draft.revision }),
    withdraw: (versionId: string, reason: string) =>
      mutate('/api/workspace/withdraw/', { resourceId, versionId, reason }),
  };
}
