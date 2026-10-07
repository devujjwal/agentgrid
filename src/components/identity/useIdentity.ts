'use client';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
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
    // Clear private subtrees before a document is frozen or hidden. Returning
    // to a tab or browser-history snapshot always requires remote verification.
    const conceal = () => {
      controller.abort();
      flushSync(() => {
        setSnapshot({ retry: -1, identity: null, error: null });
      });
    };
    const resume = () => setRetry((value) => value + 1);
    const visibility = () => (document.hidden ? conceal() : resume());
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) resume();
    };
    window.addEventListener('pagehide', conceal);
    window.addEventListener('pageshow', restored);
    document.addEventListener('visibilitychange', visibility);
    if (!document.hidden)
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
    return () => {
      controller.abort();
      window.removeEventListener('pagehide', conceal);
      window.removeEventListener('pageshow', restored);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [retry]);
  return {
    identity: retry === snapshot.retry ? snapshot.identity : null,
    error: retry === snapshot.retry ? snapshot.error : null,
    pending: retry !== snapshot.retry,
    reload: () => setRetry((value) => value + 1),
    signedOut: (csrf: string) =>
      setSnapshot({ retry, identity: { signedIn: false, csrf }, error: null }),
  };
}
