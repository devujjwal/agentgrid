'use client';
import { useEffect, useState } from 'react';
import type { IdentityResponse } from '../../domain/session';
import { WorkspaceIdentitySchema, type WorkspaceIdentity } from '../../domain/workspace';
import { ReviewContextSchema, type ReviewContext } from '../../domain/reviews';
import { communityRequest } from '../../services/community';

export function useReviewContext(connection: IdentityResponse | null, resourceId: string) {
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    connection: IdentityResponse;
    resourceId: string;
    retry: number;
    workspace: WorkspaceIdentity | null;
    context: ReviewContext | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (connection?.signedIn)
      void communityRequest(
        '/api/workspace/',
        WorkspaceIdentitySchema,
        undefined,
        controller.signal,
      )
        .then(async (workspace) => {
          const context =
            workspace.profile?.status === 'active'
              ? await communityRequest(
                  '/api/workspace/reviewcontext/?resourceId=' + resourceId,
                  ReviewContextSchema,
                  undefined,
                  controller.signal,
                )
              : null;
          if (!controller.signal.aborted)
            setSnapshot({ connection, resourceId, retry, workspace, context, error: null });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              connection,
              resourceId,
              retry,
              workspace: null,
              context: null,
              error: error instanceof Error ? error.message : 'Review access is unavailable.',
            });
        });
    return () => controller.abort();
  }, [connection, resourceId, retry]);
  const current =
    snapshot?.connection === connection &&
    snapshot.resourceId === resourceId &&
    snapshot.retry === retry
      ? snapshot
      : null;
  return {
    workspace: current?.workspace,
    context: current?.context,
    error: current?.error,
    pending: Boolean(connection?.signedIn && !current),
    reload: () => setRetry((value) => value + 1),
  };
}
