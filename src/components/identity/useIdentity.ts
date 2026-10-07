'use client';
import { useEffect, useState } from 'react';
import { IdentityResponseSchema, type IdentityResponse } from '../../domain/session';
import { communityRequest } from '../../services/community';

export function useIdentity() {
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    identity: IdentityResponse | null;
    error: string | null;
  }>({
    retry: -1,
    identity: null,
    error: null,
  });
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(
      '/api/identity/',
      IdentityResponseSchema,
      undefined,
      controller.signal,
    ).then(
      (identity) => {
        if (!controller.signal.aborted) setSnapshot({ retry, identity, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            identity: null,
            error: error instanceof Error ? error.message : 'Unable to connect.',
          });
      },
    );
    return () => controller.abort();
  }, [retry]);
  return {
    identity: snapshot.identity,
    error: snapshot.error,
    pending: retry !== snapshot.retry,
    reload: () => setRetry((value) => value + 1),
    signedOut: (csrf: string) =>
      setSnapshot({ retry, identity: { signedIn: false, csrf }, error: null }),
  };
}
