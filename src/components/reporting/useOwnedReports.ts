'use client';
import { useEffect, useState } from 'react';
import { OwnedReportsSchema, type OwnedReports } from '../../domain/reports';
import type { IdentityResponse } from '../../domain/session';
import { communityRequest } from '../../services/community';

export function useOwnedReports(connection: IdentityResponse | null) {
  const [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    connection: IdentityResponse;
    offset: number;
    retry: number;
    history: OwnedReports | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (connection?.signedIn)
      void communityRequest(
        '/api/workspace/reports/?offset=' + offset,
        OwnedReportsSchema,
        undefined,
        controller.signal,
      ).then(
        (history) => {
          if (!controller.signal.aborted)
            setSnapshot({ connection, offset, retry, history, error: null });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              connection,
              offset,
              retry,
              history: null,
              error: error instanceof Error ? error.message : 'Report history is unavailable.',
            });
        },
      );
    return () => controller.abort();
  }, [connection, offset, retry]);
  const current =
    snapshot?.connection === connection && snapshot.offset === offset && snapshot.retry === retry
      ? snapshot
      : null;
  return {
    history: current?.history,
    error: current?.error,
    pending: Boolean(connection?.signedIn && !current),
    changeOffset: setOffset,
    reload: () => setRetry((value) => value + 1),
  };
}
