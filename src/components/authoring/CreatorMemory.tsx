'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { flushSync } from 'react-dom';
import type { DraftEditorial } from '../../domain/draft-editorial';
import type { DraftRecord, DraftSpecification } from '../../domain/draft';
import type { ProfileEditBuffer } from '../workspace/ProfileEditor';
import type { ReportInput } from '../../domain/reports';
import type { ReviewInput } from '../../domain/reviews';

export interface SubmissionModerationBuffer {
  email: string;
  versionId: string;
  explanation: string;
}

export interface ReportModerationBuffer {
  email: string;
  reportId: string;
  explanation: string;
}

export interface ModerationBuffer {
  email: string;
  reviewId: string;
  explanation: string;
  revision: number;
  decisionRevision: number;
}

export interface ReviewBuffer {
  email: string;
  input: ReviewInput;
  path: string;
  label: string;
}

export interface ReportBuffer {
  email: string;
  input: ReportInput;
  path: string;
  label: string;
}

export interface DraftBuffer {
  email: string;
  record: DraftRecord;
  value: DraftSpecification;
  editorial: DraftEditorial;
  dirty: boolean;
  conflict: boolean;
}
const Memory = createContext<{
  hasUnsaved: boolean;
  submissionModerationNotes: SubmissionModerationBuffer | null;
  setSubmissionModerationNotes: Dispatch<SetStateAction<SubmissionModerationBuffer | null>>;
  reportModerationNotes: ReportModerationBuffer | null;
  setReportModerationNotes: Dispatch<SetStateAction<ReportModerationBuffer | null>>;
  moderationNotes: ModerationBuffer | null;
  setModerationNotes: Dispatch<SetStateAction<ModerationBuffer | null>>;
  buffer: DraftBuffer | null;
  setBuffer: Dispatch<SetStateAction<DraftBuffer | null>>;
  profileEdits: ProfileEditBuffer | null;
  setProfileEdits: Dispatch<SetStateAction<ProfileEditBuffer | null>>;
  reportEdits: ReportBuffer | null;
  setReportEdits: Dispatch<SetStateAction<ReportBuffer | null>>;
  reviewEdits: ReviewBuffer | null;
  setReviewEdits: Dispatch<SetStateAction<ReviewBuffer | null>>;
} | null>(null);

/** Bounded tab-local draft/profile/report edits survive App Router history, never reloads
 * or storage. Private consumers render only after fresh identity/ownership checks.
 * This provider performs no session or data request on public page views. */
export function CreatorMemoryProvider({ children }: { children: ReactNode }) {
  const [submissionModerationNotes, setSubmissionModerationNotes] =
    useState<SubmissionModerationBuffer | null>(null);
  const [reportModerationNotes, setReportModerationNotes] = useState<ReportModerationBuffer | null>(
    null,
  );
  const [moderationNotes, setModerationNotes] = useState<ModerationBuffer | null>(null);
  const [buffer, setBuffer] = useState<DraftBuffer | null>(null);
  const [profileEdits, setProfileEdits] = useState<ProfileEditBuffer | null>(null);
  const [reportEdits, setReportEdits] = useState<ReportBuffer | null>(null);
  const [reviewEdits, setReviewEdits] = useState<ReviewBuffer | null>(null);
  useEffect(() => {
    if (
      !buffer?.dirty &&
      !profileEdits?.dirty &&
      !reportEdits?.input.explanation &&
      !reviewEdits &&
      !moderationNotes?.explanation &&
      !reportModerationNotes?.explanation &&
      !submissionModerationNotes?.explanation
    )
      return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      if (
        !buffer?.dirty ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return;
      const target = new URL(anchor.href);
      // Ordinary internal browsing retains the buffer. A different authoring
      // resource must not silently replace this tab's single unsaved definition.
      if (
        target.origin !== window.location.origin ||
        target.pathname !== '/workspace/agent/' ||
        target.searchParams.get('resourceId') === buffer.record.resourceId
      )
        return;
      if (
        !window.confirm(
          'Replace the unsaved draft in this tab? Return to it and save or download the private definition and guide first if you need to keep it.',
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      } else flushSync(() => setBuffer(null));
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', navigate, true);
    };
  }, [
    buffer,
    profileEdits,
    reportEdits,
    reviewEdits,
    moderationNotes,
    reportModerationNotes,
    submissionModerationNotes,
  ]);
  return (
    <Memory.Provider
      value={{
        hasUnsaved: Boolean(
          buffer?.dirty ||
          profileEdits?.dirty ||
          reportEdits?.input.explanation ||
          reviewEdits ||
          moderationNotes?.explanation ||
          reportModerationNotes?.explanation ||
          submissionModerationNotes?.explanation,
        ),
        buffer,
        setBuffer,
        profileEdits,
        setProfileEdits,
        reportEdits,
        setReportEdits,
        reviewEdits,
        setReviewEdits,
        moderationNotes,
        setModerationNotes,
        submissionModerationNotes,
        setSubmissionModerationNotes,
        reportModerationNotes,
        setReportModerationNotes,
      }}
    >
      {children}
    </Memory.Provider>
  );
}
export function useCreatorMemory() {
  const memory = useContext(Memory);
  if (!memory) throw new Error('Creator memory requires the application boundary.');
  return memory;
}
