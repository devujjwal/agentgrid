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
import type { DraftRecord, DraftSpecification } from '../../domain/draft';
import type { ProfileEditBuffer } from '../workspace/ProfileEditor';

export interface DraftBuffer {
  email: string;
  record: DraftRecord;
  value: DraftSpecification;
  dirty: boolean;
  conflict: boolean;
}
const Memory = createContext<{
  buffer: DraftBuffer | null;
  setBuffer: Dispatch<SetStateAction<DraftBuffer | null>>;
  profileEdits: ProfileEditBuffer | null;
  setProfileEdits: Dispatch<SetStateAction<ProfileEditBuffer | null>>;
} | null>(null);

/** Bounded tab-local draft/profile edits survive App Router history, never reloads
 * or storage. Private consumers render only after fresh identity/ownership checks.
 * This provider performs no session or data request on public page views. */
export function CreatorMemoryProvider({ children }: { children: ReactNode }) {
  const [buffer, setBuffer] = useState<DraftBuffer | null>(null);
  const [profileEdits, setProfileEdits] = useState<ProfileEditBuffer | null>(null);
  useEffect(() => {
    if (!buffer?.dirty && !profileEdits?.dirty) return;
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
          'Replace the unsaved draft in this tab? Return to it and save or download the private definition first if you need to keep it.',
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
  }, [buffer, profileEdits]);
  return (
    <Memory.Provider value={{ buffer, setBuffer, profileEdits, setProfileEdits }}>
      {children}
    </Memory.Provider>
  );
}
export function useCreatorMemory() {
  const memory = useContext(Memory);
  if (!memory) throw new Error('Creator memory requires the application boundary.');
  return memory;
}
