'use client';

import { useEffect, useState } from 'react';
import type { DiscoveryQuery, SearchProvider } from '../../domain/discovery';

/** The UI consumes an asynchronous provider, including stale-response and error
 * handling. A future remote adapter can change ranking without rebuilding views.
 * Initial results are rendered into HTML; user queries have no indexable URL.
 */
export function useDiscoverySearch(provider: SearchProvider, query: DiscoveryQuery) {
  const key = JSON.stringify(query);
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState({
    provider,
    key,
    retry: 0,
    page: provider.initialPage,
    failed: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void provider.search(query, controller.signal).then(
        (page) => {
          if (!controller.signal.aborted)
            setSnapshot({ provider, key, retry, page, failed: false });
        },
        () => {
          if (!controller.signal.aborted)
            setSnapshot({
              provider,
              key,
              retry,
              page: { matches: [], total: 0, offset: query.offset ?? 0, limit: 30 },
              failed: true,
            });
        },
      );
    }, 100);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [provider, query, key, retry]);
  const pending =
    snapshot.provider !== provider || snapshot.key !== key || snapshot.retry !== retry;
  return {
    page: snapshot.provider === provider ? snapshot.page : provider.initialPage,
    pending,
    failed: !pending && snapshot.failed,
    retry: () => setRetry((value) => value + 1),
  };
}
