'use client';
import { useEffect, useRef, useState } from 'react';
import { HostRunListSchema } from '../../domain/host-verification';
import { StaffResourceSchema } from '../../domain/resource-moderation';
import {
  ReleaseApprovalsSchema,
  ReleaseApprovalSchema,
  type RequestRelease,
  type ReleaseApproval,
} from '../../domain/release-approval';
import type { StaffSubmission } from '../../domain/submission-moderation';
import { communityRequest } from '../../services/community';
import { useCreatorMemory } from '../authoring/CreatorMemory';

async function load(versionId: string, resourceId: string, signal: AbortSignal) {
  const [evidence, resource, requests] = await Promise.all([
    communityRequest(
      '/api/moderation/host-runs/?versionId=' + versionId,
      HostRunListSchema,
      undefined,
      signal,
    ),
    communityRequest(
      '/api/moderation/resource/?resourceId=' + resourceId,
      StaffResourceSchema,
      undefined,
      signal,
    ),
    communityRequest(
      '/api/moderation/release-requests/?versionId=' + versionId,
      ReleaseApprovalsSchema,
      undefined,
      signal,
    ),
  ]);
  return { evidence, resource, requests };
}
export function useReleaseApproval({
  submission,
  email,
  csrf,
}: {
  submission: StaffSubmission;
  email: string;
  csrf: string;
}) {
  const memory = useCreatorMemory(),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    data: Awaited<ReturnType<typeof load>> | null;
    error: string | null;
  } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(submission.versionId, submission.resourceId, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setSnapshot({ retry, data, error: null });
          setUncertain(false);
        }
      },
      () => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            data: null,
            error: 'The review state is unavailable. Check staff access before continuing.',
          });
      },
    );
    return () => controller.abort();
  }, [submission.versionId, submission.resourceId, retry]);
  const current = snapshot?.retry === retry ? snapshot : null,
    data = current?.data;
  const held = memory.releaseReview?.email === email ? memory.releaseReview : null;
  const buffer = held?.versionId === submission.versionId ? held : null;
  const recorded = Boolean(
    buffer && data?.requests.approvals.some((row) => row.requestId === buffer.draft.requestId),
  );
  async function mutate(input: RequestRelease | string) {
    if (busy || uncertain || !data) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const receipt = await communityRequest(
        typeof input === 'string'
          ? '/api/moderation/release-cancel/'
          : '/api/moderation/release-request/',
        ReleaseApprovalSchema,
        { csrf, body: typeof input === 'string' ? { requestId: input } : input },
      );
      if (!mounted.current) return;
      const expectedId = typeof input === 'string' ? input : input.requestId;
      if (receipt.requestId !== expectedId || receipt.versionId !== submission.versionId)
        throw new Error('Uncertain receipt');
      const approvals: ReleaseApproval[] = [
        ...data.requests.approvals.filter((row) => row.requestId !== receipt.requestId),
        receipt,
      ];
      setSnapshot({
        retry,
        data: { ...data, requests: { ...data.requests, approvals } },
        error: null,
      });
      if (typeof input !== 'string') memory.setReleaseReview(null);
      setMessage(
        receipt.state === 'cancelled'
          ? 'The publication request was cancelled.'
          : `Review recorded. Reference ${receipt.requestId}. Publication still requires all quality and eligibility checks to pass.`,
      );
    } catch {
      if (!mounted.current) return;
      setUncertain(true);
      setError(
        'The request may have been recorded, or the reviewed state may have changed. Refresh publication status before another action. Your unsaved review is retained.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const binding = data
    ? {
        versionId: submission.versionId,
        expectedDigest: submission.contentDigest,
        expectedResourceRevision: data.resource.revision,
        expectedReleaseId: data.resource.releasedVersionId,
      }
    : null;
  const changed = Boolean(
    buffer &&
    binding &&
    (buffer.binding.expectedDigest !== binding.expectedDigest ||
      buffer.binding.expectedResourceRevision !== binding.expectedResourceRevision ||
      buffer.binding.expectedReleaseId !== binding.expectedReleaseId),
  );
  const disabled =
    changed ||
    busy ||
    uncertain ||
    submission.state !== 'pending' ||
    data?.resource.status !== 'active' ||
    data.resource.ownerStatus !== 'active' ||
    (data?.requests.approvals.length ?? 0) >= 20;
  return {
    memory,
    setRetry,
    busy,
    uncertain,
    message,
    setMessage,
    error,
    setError,
    current,
    data,
    held,
    buffer,
    recorded,
    mutate,
    binding,
    changed,
    disabled,
  };
}
