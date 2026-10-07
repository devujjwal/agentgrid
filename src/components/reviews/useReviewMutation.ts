'use client';
import { useEffect, useRef, useState } from 'react';
import { IdentityResponseSchema, type IdentityResponse } from '../../domain/session';
import {
  OwnedReviewSchema,
  ReviewInputSchema,
  WithdrawReviewSchema,
  type ReviewInput,
  type ReviewContext,
} from '../../domain/reviews';
import { CommunityError, communityRequest } from '../../services/community';

export function useReviewMutation(
  connection: IdentityResponse | null,
  resourceId: string,
  context: ReviewContext | null | undefined,
) {
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    connection: IdentityResponse;
    resourceId: string;
    message: string;
    context: ReviewContext | null | undefined;
    recovery: boolean;
  } | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [connection, resourceId],
  );
  async function mutate(
    input: ReviewInput | { resourceId: string; expectedRevision: number },
    withdraw: boolean,
  ) {
    if (!connection?.signedIn || input.resourceId !== resourceId || active.current) return false;
    const parsed = withdraw
      ? WithdrawReviewSchema.safeParse(input)
      : ReviewInputSchema.safeParse(input);
    if (!parsed.success) {
      setFeedback({
        connection,
        resourceId,
        context,
        recovery: false,
        message: 'Check the version, rating and required review details.',
      });
      return false;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFeedback(null);
    let sent = false;
    try {
      const verified = await communityRequest(
        '/api/identity/',
        IdentityResponseSchema,
        undefined,
        controller.signal,
      );
      if (!verified.signedIn || verified.email !== connection.email)
        throw new Error('Your identity changed. Reconnect before continuing.');
      sent = true;
      const saved = await communityRequest(
        withdraw ? '/api/workspace/reviewwithdraw/' : '/api/workspace/review/',
        OwnedReviewSchema,
        { csrf: verified.csrf, body: parsed.data },
        controller.signal,
      );
      if (controller.signal.aborted) return false;
      if (
        saved.resourceId !== resourceId ||
        saved.revision !== input.expectedRevision + 1 ||
        (withdraw ? saved.state !== 'withdrawn' : saved.state === 'withdrawn')
      )
        throw new CommunityError('service-unavailable');
      return true;
    } catch (error) {
      if (!controller.signal.aborted)
        setFeedback({
          connection,
          resourceId,
          context,
          recovery: sent,
          message:
            error instanceof CommunityError && error.code === 'conflict'
              ? 'Your review changed. Refresh its status and compare the saved review before trying again.'
              : sent && error instanceof CommunityError && error.code === 'service-unavailable'
                ? 'Confirmation did not arrive. Your change may have been received. Refresh your review status before retrying.'
                : error instanceof Error
                  ? error.message
                  : 'The change could not be confirmed. Refresh your review status.',
        });
      return false;
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return {
    busy,
    error:
      feedback?.connection === connection &&
      feedback.resourceId === resourceId &&
      feedback.context === context
        ? feedback.message
        : null,
    needsRecovery: Boolean(
      feedback?.connection === connection &&
      feedback.resourceId === resourceId &&
      feedback.context === context &&
      feedback.recovery,
    ),
    write: (input: ReviewInput) => mutate(input, false),
    withdraw: (expectedRevision: number) => mutate({ resourceId, expectedRevision }, true),
  };
}
