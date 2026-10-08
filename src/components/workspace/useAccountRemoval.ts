'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { DeactivatedAccountSchema } from '../../domain/account';
import { WorkspaceIdentitySchema, type WorkspaceIdentity } from '../../domain/workspace';
import { IdentityResponseSchema } from '../../domain/session';
import { communityRequest } from '../../services/community';
import { useCreatorMemory } from '../authoring/CreatorMemory';
export function useAccountRemoval({
  profile,
  csrf,
  email,
}: {
  profile: NonNullable<WorkspaceIdentity['profile']>;
  csrf: string;
  email: string;
}) {
  const memory = useCreatorMemory();
  const router = useRouter();
  const [username, setUsername] = useState(''),
    [acknowledged, setAcknowledged] = useState(false);
  const [state, setState] = useState<'ready' | 'removing' | 'uncertain' | 'checking' | 'removed'>(
    'ready',
  );
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const active = useRef<AbortController | null>(null),
    message = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (error || notice) message.current?.focus();
  }, [error, notice]);
  function completed() {
    memory.clear();
    setState('removed');
    setError(null);
    setNotice('Your original AgentGrid profile is no longer linked to this sign-in.');
  }
  async function remove() {
    if (active.current || state !== 'ready' || username !== profile.username || !acknowledged)
      return;
    const controller = new AbortController();
    active.current = controller;
    setState('removing');
    setError(null);
    setNotice(null);
    try {
      const result = await communityRequest(
        '/api/workspace/deactivate/',
        DeactivatedAccountSchema,
        {
          csrf,
          body: { profileId: profile.id, username, understandsRemoval: true },
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (result.profileId !== profile.id)
        throw new Error('Account removal could not be confirmed.');
      completed();
      setNotice('Your AgentGrid account has been deactivated.');
    } catch {
      if (!controller.signal.aborted) {
        setState('uncertain');
        setError(
          'Removal was not confirmed. Check the live account status before taking another action.',
        );
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  async function check() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState('checking');
    setError(null);
    try {
      const identity = await communityRequest(
        '/api/identity/',
        IdentityResponseSchema,
        undefined,
        controller.signal,
      );
      if (!identity.signedIn || identity.email !== email)
        throw new Error(
          'Your sign-in changed. Reconnect to the original account before checking its status.',
        );
      const workspace = await communityRequest(
        '/api/workspace/',
        WorkspaceIdentitySchema,
        undefined,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (workspace.profile === null) {
        completed();
        return;
      }
      if (workspace.profile.id !== profile.id || workspace.profile.status !== 'active')
        throw new Error(
          'The original profile is no longer available here. Return to your workspace to inspect its current state.',
        );
      setAcknowledged(false);
      setUsername('');
      setState('ready');
      setNotice(
        'Your original account is still active. Review the removal details and confirm again only if you still want to deactivate it.',
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        setState('uncertain');
        setError(error instanceof Error ? error.message : 'Account status could not be checked.');
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }
  async function signOut() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setSigningOut(true);
    setError(null);
    try {
      await communityRequest(
        '/api/identity/logout/',
        z.strictObject({ signedIn: z.literal(false), csrf: z.string() }),
        { csrf, body: {} },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        memory.clear();
        router.replace('/sign-in/');
      }
    } catch {
      if (!controller.signal.aborted)
        setError('Sign-out was not confirmed. You can retry; your account removal is unaffected.');
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setSigningOut(false);
    }
  }
  return {
    memory,
    username,
    setUsername,
    acknowledged,
    setAcknowledged,
    state,
    error,
    notice,
    message,
    remove,
    check,
    signOut,
    signingOut,
  };
}
