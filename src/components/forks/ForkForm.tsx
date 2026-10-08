'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ForkInputSchema,
  ForkReceiptSchema,
  type ForkSource,
  type ForkReceipt,
} from '../../domain/forks';
import { CommunityError, communityRequest } from '../../services/community';
export function ForkForm({ source, csrf }: { source: ForkSource; csrf: string }) {
  const [name, setName] = useState((source.name + ' — my branch').slice(0, 100)),
    [slug, setSlug] = useState('');
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState<string | null>(null),
    [receipt, setReceipt] = useState<ForkReceipt | null>(null);
  const mounted = useRef(true),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (receipt) heading.current?.focus();
  }, [receipt]);
  const parsed = ForkInputSchema.safeParse({ sourceVersionId: source.sourceVersionId, name, slug });
  const invalidSlug = slug.length > 0 && !ForkInputSchema.shape.slug.safeParse(slug).success;
  const invalidName = !ForkInputSchema.shape.name.safeParse(name).success;
  async function create() {
    if (busy || receipt || !parsed.success) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await communityRequest('/api/workspace/fork/', ForkReceiptSchema, {
        csrf,
        body: parsed.data,
      });
      if (!mounted.current) return;
      if (saved.sourceVersionId !== source.sourceVersionId || saved.slug !== slug)
        throw new Error('Unconfirmed fork');
      setReceipt(saved);
      setUncertain(false);
    } catch (failure) {
      if (!mounted.current) return;
      const known =
        failure instanceof CommunityError &&
        [
          'conflict',
          'invalid-request',
          'request-refused',
          'not-signed-in',
          'rate-limited',
        ].includes(failure.code);
      setUncertain(!known);
      setError(
        known
          ? failure.code === 'conflict'
            ? 'That resource path is unavailable. Choose a different path.'
            : failure.message
          : 'The fork may have been created, but confirmation did not arrive. Retry the same request to recover it, or check your workspace. Your current name and path are kept unchanged.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className={'fork-connection' + (receipt ? ' fork-connected' : '')} aria-busy={busy}>
      <section className="fork-source" aria-labelledby="fork-source-title">
        <p className="eyebrow">01 / original signal</p>
        <h2 id="fork-source-title">{source.name}</h2>
        <p>
          Version {source.version} · {source.creatorName}
        </p>
        <Link prefetch={false} href={'/agents/' + source.slug + '/'}>
          Read the source agent ↗
        </Link>
        <div className="fork-rights">
          <h3>Rights travel with the work.</h3>
          <p>
            <strong>{source.license.identifier}</strong>
          </p>
          <p>{source.license.statement}</p>
          {source.license.url && (
            <a href={source.license.url} rel="nofollow noopener noreferrer">
              Read the source license
            </a>
          )}
          <p>
            Your fork retains this license and its source attribution. Editing instructions does not
            remove these conditions.
          </p>
        </div>
      </section>
      <svg className="fork-path" viewBox="0 0 96 240" aria-hidden="true">
        <path d="M24 16V120Q24 144 48 144H72V224" />
        <circle cx="24" cy="16" r="7" />
        <circle className="fork-new-node" cx="72" cy="224" r="7" />
      </svg>
      <section className="identity-panel fork-destination" aria-labelledby="fork-destination-title">
        <p className="eyebrow">02 / your direction</p>
        <h2 id="fork-destination-title" ref={heading} tabIndex={-1}>
          {receipt ? 'Your branch is connected.' : 'Give your fork an identity.'}
        </h2>
        {receipt ? (
          <>
            <p role="status">
              {receipt.created
                ? 'Your private fork is ready.'
                : 'Your existing fork was recovered. No duplicate was created.'}
            </p>
            <p>
              Source: {source.name} · {source.version}. The fork is private until you submit it and
              it passes publication review.
            </p>
            <Link
              prefetch={false}
              className="action-primary"
              href={'/workspace/agent/?resourceId=' + receipt.resourceId}
            >
              Edit your fork <span aria-hidden="true">↗</span>
            </Link>
          </>
        ) : (
          <>
            <p>
              Start with the source’s instructions and setup. Your draft begins at version 0.1.0;
              examples and compatibility must be checked again after your changes.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <label htmlFor="fork-name">Fork name</label>
              <input
                id="fork-name"
                aria-invalid={invalidName}
                aria-describedby={invalidName ? 'fork-name-error' : undefined}
                value={name}
                minLength={4}
                maxLength={100}
                required
                disabled={busy || uncertain}
                onChange={(event) => setName(event.target.value)}
              />
              {invalidName && <p id="fork-name-error">Use a name between 4 and 100 characters.</p>}
              <label htmlFor="fork-slug">Resource path</label>
              <input
                id="fork-slug"
                value={slug}
                minLength={3}
                maxLength={80}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                required
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={invalidSlug}
                aria-describedby={invalidSlug ? 'fork-path-help fork-path-error' : 'fork-path-help'}
                disabled={busy || uncertain}
                onChange={(event) => setSlug(event.target.value)}
              />
              <p id="fork-path-help">
                Use lowercase words separated by hyphens. This path stays fixed after creation.
                Example: weekly-team-triage.
              </p>
              {invalidSlug && (
                <p id="fork-path-error">
                  Use 3–80 lowercase letters, numbers and single hyphens. The paths categories, new,
                  search and submit are reserved.
                </p>
              )}
              {error && <p role="alert">{error}</p>}
              <button className="action-primary" disabled={busy || !parsed.success}>
                {busy
                  ? 'Connecting your branch…'
                  : uncertain
                    ? 'Recover the same fork'
                    : 'Create private fork'}{' '}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
            <p className="identity-footnote">
              Creating a fork does not publish it, install it on a platform, or copy the source’s
              editorial approval.
            </p>
          </>
        )}
        <p>
          <Link prefetch={false} href="/workspace/">
            Your workspace
          </Link>
        </p>
      </section>
    </div>
  );
}
