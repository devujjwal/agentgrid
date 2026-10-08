'use client';
import { useEffect, useState } from 'react';
import type { IdentityResponse } from '../../domain/session';
import { WorkspaceIdentitySchema, type WorkspaceIdentity } from '../../domain/workspace';
import { communityRequest } from '../../services/community';

export function useModerationAccess(connection: IdentityResponse | null) {
  const [snapshot, setSnapshot] = useState<{
    connection: IdentityResponse;
    workspace: WorkspaceIdentity | null;
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
      ).then(
        (workspace) => {
          if (!controller.signal.aborted) setSnapshot({ connection, workspace, error: null });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              connection,
              workspace: null,
              error: error instanceof Error ? error.message : 'Staff access could not be checked.',
            });
        },
      );
    return () => controller.abort();
  }, [connection]);
  const current = snapshot?.connection === connection ? snapshot : null;
  return {
    pending: Boolean(connection?.signedIn && !current),
    error: current?.error,
    allowed:
      current?.workspace?.profile?.status === 'active' && Boolean(current.workspace.roles.length),
    administrator:
      current?.workspace?.profile?.status === 'active' &&
      current.workspace.roles.includes('administrator'),
  };
}
