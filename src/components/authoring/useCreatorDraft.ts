'use client';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  DraftRecordSchema,
  parseDraftSpecification,
  type DraftSpecification,
} from '../../domain/draft';
import { WorkspaceIdentitySchema, type WorkspaceIdentity } from '../../domain/workspace';
import type { IdentityResponse } from '../../domain/session';
import { formatAuthoringIssue } from '../../domain/authoring-issues';
import { communityRequest, CommunityError } from '../../services/community';
import { useCreatorMemory } from './CreatorMemory';

export function useCreatorDraft(identity: IdentityResponse | null, resourceId: string | null) {
  const email = identity?.signedIn ? identity.email : null;
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    connection: IdentityResponse | null;
    id: string | null;
    message: string | null;
    error: string | null;
  } | null>(null);
  function setNotice(kind: 'message' | 'error', value: string | null) {
    setFeedback((current) => ({
      connection: identity,
      id: resourceId,
      message:
        current?.connection === identity && current.id === resourceId ? current.message : null,
      error: current?.connection === identity && current.id === resourceId ? current.error : null,
      [kind]: value,
    }));
  }
  const active = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<{
    connection: IdentityResponse | null;
    email: string | null;
    id: string | null;
    retry: number;
    holding: boolean;
    workspace: WorkspaceIdentity | null;
    error: string | null;
  }>({
    connection: null,
    email: null,
    id: null,
    retry: -1,
    holding: false,
    workspace: null,
    error: null,
  });
  // In-memory edits survive tab concealment. They never render until the same
  // identity is freshly verified, and never enter persistent browser storage.
  const { buffer, setBuffer } = useCreatorMemory();
  const holding = Boolean(
    buffer?.dirty && buffer.email === email && buffer.record.resourceId !== resourceId,
  );
  const [section, setSection] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (email)
      void communityRequest(
        '/api/workspace/',
        WorkspaceIdentitySchema,
        undefined,
        controller.signal,
      )
        .then(async (workspace) => {
          if (workspace.profile?.status === 'active' && resourceId && !holding) {
            const record = await communityRequest(
              '/api/workspace/draft/?resourceId=' + resourceId,
              DraftRecordSchema,
              undefined,
              controller.signal,
            );
            if (controller.signal.aborted) return;
            setBuffer((current) =>
              current?.email === email && current.record.resourceId === resourceId && current.dirty
                ? {
                    ...current,
                    conflict: current.conflict || current.record.revision !== record.revision,
                    record: { ...current.record, status: record.status },
                  }
                : { email, record, value: record.specification, dirty: false, conflict: false },
            );
          }
          if (!controller.signal.aborted)
            setSnapshot({
              connection: identity,
              email,
              id: resourceId,
              retry,
              holding,
              workspace,
              error: null,
            });
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              connection: identity,
              email,
              id: resourceId,
              retry,
              holding,
              workspace: null,
              error: error instanceof Error ? error.message : 'Your draft could not be loaded.',
            });
        });
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, [identity, email, resourceId, retry, setBuffer, holding]);
  const ready =
    snapshot.connection === identity &&
    snapshot.email === email &&
    snapshot.id === resourceId &&
    snapshot.holding === holding &&
    snapshot.retry === retry;
  const owned =
    ready &&
    email &&
    snapshot.workspace?.profile?.status === 'active' &&
    buffer?.email === email &&
    buffer.record.resourceId === resourceId
      ? buffer
      : null;
  async function mutate<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
    if (
      active.current ||
      !identity?.signedIn ||
      !ready ||
      snapshot.workspace?.profile?.status !== 'active'
    )
      return null;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setNotice('message', null);
    setNotice('error', null);
    try {
      const result = await action(controller.signal);
      return controller.signal.aborted ? null : result;
    } catch (error) {
      if (
        !controller.signal.aborted &&
        resourceId &&
        error instanceof CommunityError &&
        error.code === 'conflict'
      )
        setBuffer((current) =>
          current?.email === email && current.record.resourceId === resourceId
            ? { ...current, conflict: true }
            : current,
        );
      if (!controller.signal.aborted)
        setNotice(
          'error',
          error instanceof z.ZodError
            ? error.issues.slice(0, 8).map(formatAuthoringIssue).join(' ')
            : error instanceof Error
              ? error.message
              : 'The draft could not be saved.',
        );
      return null;
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return {
    pending: !ready,
    workspace: ready ? snapshot.workspace : null,
    loadError: ready ? snapshot.error : null,
    buffer: owned,
    retainedEdits: Boolean(buffer?.dirty && buffer.record.resourceId === resourceId),
    heldResourceId:
      ready && holding && snapshot.workspace?.profile?.status === 'active'
        ? buffer!.record.resourceId
        : null,
    busy,
    message:
      ready && feedback?.connection === identity && feedback.id === resourceId
        ? feedback.message
        : null,
    error:
      ready && feedback?.connection === identity && feedback.id === resourceId
        ? feedback.error
        : null,
    section,
    setSection,
    reload: () => setRetry((value) => value + 1),
    change: (value: DraftSpecification) => {
      if (owned) setBuffer({ ...owned, value, dirty: true });
    },
    discard: () => {
      setBuffer(null);
      setFeedback(null);
      setRetry((value) => value + 1);
    },
    create: async (value: DraftSpecification) =>
      mutate(async (signal) => {
        const specification = parseDraftSpecification(value);
        return communityRequest(
          '/api/workspace/create/',
          DraftRecordSchema,
          { csrf: identity!.csrf, body: { specification } },
          signal,
        );
      }),
    save: async () => {
      if (!owned || owned.conflict || owned.record.status !== 'active') return;
      const result = await mutate(async (signal) =>
        communityRequest(
          '/api/workspace/draft/',
          z.strictObject({ revision: z.int().positive() }),
          {
            csrf: identity!.csrf,
            body: {
              resourceId,
              expectedRevision: owned.record.revision,
              specification: parseDraftSpecification(owned.value),
            },
          },
          signal,
        ),
      );
      if (!result) return;
      if (result.revision !== owned.record.revision + 1) {
        setNotice('error', 'The saved revision could not be confirmed. Reload before continuing.');
        return;
      }
      setBuffer((current) =>
        current === owned
          ? { ...owned, record: { ...owned.record, revision: result.revision }, dirty: false }
          : current,
      );
      setNotice('message', 'Private draft saved.');
      setRetry((value) => value + 1);
    },
  };
}
