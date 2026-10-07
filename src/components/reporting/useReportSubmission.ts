'use client';
import { useEffect, useRef, useState } from 'react';
import { IdentityResponseSchema, type IdentityResponse } from '../../domain/session';
import { WorkspaceIdentitySchema, type WorkspaceIdentity } from '../../domain/workspace';
import {
  OwnedReportSchema,
  ReportInputSchema,
  type OwnedReport,
  type ReportInput,
} from '../../domain/reports';
import { CommunityError, communityRequest } from '../../services/community';

export function useReportSubmission(
  connection: IdentityResponse | null,
  targetId: string,
  targetKind: ReportInput['targetKind'],
) {
  const target = targetKind + ':' + targetId;
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false);
  const active = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<{
    connection: IdentityResponse;
    target: string;
    retry: number;
    workspace: WorkspaceIdentity | null;
    error: string | null;
  } | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<{
    connection: IdentityResponse;
    target: string;
    report: OwnedReport | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (connection?.signedIn)
      void communityRequest(
        '/api/workspace/',
        WorkspaceIdentitySchema,
        undefined,
        controller.signal,
      ).then(
        (workspace) => {
          if (!controller.signal.aborted)
            setSnapshot({ connection, target, retry, workspace, error: null });
        },
        (error: unknown) => {
          if (!controller.signal.aborted)
            setSnapshot({
              connection,
              target,
              retry,
              workspace: null,
              error: error instanceof Error ? error.message : 'Reporting is unavailable.',
            });
        },
      );
    return () => {
      controller.abort();
      active.current?.abort();
    };
  }, [connection, retry, target]);
  const current =
    snapshot?.connection === connection && snapshot.target === target && snapshot.retry === retry
      ? snapshot
      : null;
  const feedback =
    acknowledgement?.connection === connection && acknowledgement.target === target
      ? acknowledgement
      : null;
  async function submit(input: ReportInput): Promise<boolean> {
    if (!connection?.signedIn || current?.workspace?.profile?.status !== 'active' || active.current)
      return false;
    const parsed = ReportInputSchema.safeParse(input);
    if (!parsed.success) {
      setAcknowledgement({
        connection,
        target,
        report: null,
        error: 'Choose a category and explain the specific concern in 40–2,400 characters.',
      });
      return false;
    }
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setAcknowledgement(null);
    let sent = false;
    try {
      const verified = await communityRequest(
        '/api/identity/',
        IdentityResponseSchema,
        undefined,
        controller.signal,
      );
      if (!verified.signedIn || verified.email !== connection.email)
        throw new Error('Your identity changed. Reconnect before reporting.');
      sent = true;
      const report = await communityRequest(
        '/api/workspace/report/',
        OwnedReportSchema,
        { csrf: verified.csrf, body: parsed.data },
        controller.signal,
      );
      if (controller.signal.aborted) return false;
      if (report.targetId !== input.targetId || report.targetKind !== input.targetKind)
        throw new Error(
          'The report could not be confirmed. Check your report history before retrying.',
        );
      setAcknowledgement({ connection, target, report, error: null });
      return true;
    } catch (error) {
      if (!controller.signal.aborted)
        setAcknowledgement({
          connection,
          target,
          report: null,
          error:
            error instanceof CommunityError && error.code === 'conflict'
              ? 'An open report in this category may already exist. Check your reports before retrying.'
              : sent && error instanceof CommunityError && error.code === 'service-unavailable'
                ? 'Confirmation did not arrive. Your report may have been received. Check your reports before retrying.'
                : error instanceof Error
                  ? error.message
                  : 'The report could not be confirmed. Check your reports before retrying.',
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
    workspace: current?.workspace,
    error: current?.error,
    pending: Boolean(connection?.signedIn && !current),
    busy,
    feedback,
    reload: () => setRetry((value) => value + 1),
    submit,
  };
}
