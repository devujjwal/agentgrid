'use client';
import { useEffect, useRef, useState } from 'react';
import {
  HostRunListSchema,
  HostRunReceiptSchema,
  summarizeHostRun,
  type HostRunSummary,
  type HostVerificationRun,
} from '../../domain/host-verification';
import { parseAgentSpecification } from '../../domain/agent-specification';
import { contentChecksum } from '../../domain/content-checksum';
import type { StaffSubmission } from '../../domain/submission-moderation';
import { communityRequest } from '../../services/community';
import { useCreatorMemory } from '../authoring/CreatorMemory';
export function useHostEvidence(submission: StaffSubmission, email: string, csrf: string) {
  const memory = useCreatorMemory(),
    [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [attested, setAttested] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    runs: HostRunSummary[];
    hash: string;
    platforms: string[];
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
    void (async () => {
      const spec = parseAgentSpecification(JSON.parse(submission.specificationText));
      const [list, hash] = await Promise.all([
        communityRequest(
          '/api/moderation/host-runs/?versionId=' + submission.versionId,
          HostRunListSchema,
          undefined,
          controller.signal,
        ),
        contentChecksum(spec),
      ]);
      if (!controller.signal.aborted) {
        setSnapshot({
          retry,
          runs: list.runs,
          hash,
          platforms: spec.platforms.map((platform) => platform.slug),
          error: null,
        });
        setUncertain(false);
      }
    })().catch(() => {
      if (!controller.signal.aborted)
        setSnapshot({
          retry,
          runs: [],
          hash: '',
          platforms: [],
          error:
            'Evidence could not be loaded, or this definition is incomplete. Refresh the submission and recheck staff access before continuing.',
        });
    });
    return () => controller.abort();
  }, [retry, submission.versionId, submission.specificationText]);
  const current = snapshot?.retry === retry ? snapshot : null;
  const held = memory.hostEvidence?.email === email ? memory.hostEvidence : null;
  const buffer = held?.versionId === submission.versionId ? held : null;
  const empty: HostVerificationRun = {
    origin: 'real-host',
    platform_slug: current?.platforms[0] ?? '',
    host_version: '',
    scenario: 'normal',
    specification_sha256: current?.hash ?? '',
    completed_on: '',
    input: '',
    observed_output: '',
    assertions: [
      { description: '', passed: false },
      { description: '', passed: false },
    ],
    reviewer_notes: '',
  };
  async function record() {
    if (!buffer || busy || uncertain || !current || current.error || !attested) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await communityRequest('/api/moderation/host-run/', HostRunReceiptSchema, {
        csrf,
        body: {
          recordId: buffer.recordId,
          versionId: submission.versionId,
          expectedDigest: submission.contentDigest,
          run: buffer.run,
        },
      });
      if (!mounted.current) return;
      memory.setHostEvidence(null);
      setAttested(false);
      setSnapshot({
        ...current,
        runs: [...current.runs.filter((run) => run.id !== saved.id), summarizeHostRun(saved)],
      });
      setMessage('Private observation recorded. This does not approve the agent for publication.');
    } catch (failure) {
      if (!mounted.current) return;
      setUncertain(true);
      setError(
        (failure instanceof Error ? failure.message : 'Recording failed.') +
          ' Check recorded evidence before retrying. Your observation is retained.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const existing = buffer && current?.runs.find((run) => run.id === buffer.recordId);
  const alreadyRecorded = existing?.contentDigest === submission.contentDigest;
  return {
    memory,
    retry,
    setRetry,
    busy,
    uncertain,
    attested,
    setAttested,
    message,
    setMessage,
    error,
    setError,
    current,
    held,
    buffer,
    empty,
    record,
    alreadyRecorded,
  };
}
