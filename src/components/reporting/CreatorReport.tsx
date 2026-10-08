'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreatorUsernameSchema,
  PublicCreatorSchema,
  creatorPath,
  type PublicCreator,
} from '../../domain/creator';
import { ReportForm } from './ReportForm';
export function CreatorReport() {
  const search = useSearchParams(),
    username = search.get('creator');
  const valid =
    CreatorUsernameSchema.safeParse(username).success &&
    search.getAll('creator').length === 1 &&
    [...search.keys()].every((key) => key === 'creator');
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    username: string | null;
    retry: number;
    creator: PublicCreator | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          '/api/community/creator/?username=' + encodeURIComponent(username!),
          {
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'error',
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          },
        );
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'This profile is no longer public.'
              : 'The current profile could not be loaded.',
          );
        const parsed = PublicCreatorSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error('Profile details could not be verified.');
        const creator = parsed.data;
        if (creator.username !== username)
          throw new Error('Profile details could not be verified.');
        if (!controller.signal.aborted) setSnapshot({ username, retry, creator, error: null });
      } catch (error) {
        if (!controller.signal.aborted)
          setSnapshot({
            username,
            retry,
            creator: null,
            error: error instanceof Error ? error.message : 'Profile unavailable.',
          });
      }
    })();
    return () => controller.abort();
  }, [username, valid, retry]);
  if (!valid) return <p role="alert">Open reporting from a public creator profile.</p>;
  if (!snapshot || snapshot.username !== username || snapshot.retry !== retry)
    return <p role="status">Loading the current public profile…</p>;
  if (snapshot.error || !snapshot.creator)
    return (
      <>
        <p role="alert">{snapshot.error ?? 'Profile unavailable.'}</p>
        <button className="action-secondary" onClick={() => setRetry((value) => value + 1)}>
          Reload profile
        </button>
      </>
    );
  const creator = snapshot.creator,
    path = '/workspace/report/?creator=' + creator.username;
  return (
    <section className="report-resource">
      <h2>Reporting @{creator.username}</h2>
      <a href={creatorPath(creator.username)}>Return to {creator.displayName} ↗</a>
      <ReportForm
        key={creator.id}
        targetId={creator.id}
        targetKind="profile"
        label={creator.displayName}
        path={path}
      />
    </section>
  );
}
