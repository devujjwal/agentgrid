'use client';
import Link from 'next/link';
export function HeldDraft({ resourceId, discard }: { resourceId: string; discard: () => void }) {
  return (
    <section className="draft-conflict">
      <h2>Another draft has unsaved changes.</h2>
      <p>
        This tab holds one working definition and guide. Return to it, or deliberately discard its
        browser-only edits before authoring another agent.
      </p>
      <Link
        prefetch={false}
        href={'/workspace/agent/?resourceId=' + resourceId}
        className="action-secondary"
      >
        Return to unsaved draft
      </Link>
      <button
        type="button"
        className="draft-text-action"
        onClick={() => {
          if (window.confirm('Discard the unsaved private draft held in this tab?')) discard();
        }}
      >
        Discard held edits and continue
      </button>
    </section>
  );
}
