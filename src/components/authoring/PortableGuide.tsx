'use client';
import { useState } from 'react';
import { parseDraftEditorial, type DraftEditorial } from '../../domain/draft-editorial';
export function PortableGuide({
  value,
  change,
  slug,
  readOnly,
}: {
  value: DraftEditorial;
  change: (value: DraftEditorial) => void;
  slug: string;
  readOnly: boolean;
}) {
  const [source, setSource] = useState(''),
    [error, setError] = useState<string | null>(null);
  function download() {
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = slug + '.private-guide.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <details className="draft-portable">
      <summary>Portable guide · advanced</summary>
      <p>
        Save a private copy before replacing unsaved work. This guide is separate from the agent
        definition; it travels with the immutable version when submitted.
      </p>
      <label htmlFor="guide-import">Paste an AgentGrid guide JSON document</label>
      <textarea
        id="guide-import"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        maxLength={32000}
        rows={8}
        disabled={readOnly}
        spellCheck={false}
      />
      <div className="draft-portable-actions">
        <button
          className="action-secondary"
          type="button"
          disabled={readOnly || !source}
          onClick={() => {
            setError(null);
            try {
              if (new TextEncoder().encode(source).byteLength > 32000) throw Error('Bounds');
              change(parseDraftEditorial(JSON.parse(source)));
              setSource('');
            } catch {
              setError(
                'Import refused. Use a bounded AgentGrid guide document with valid fields and dates.',
              );
            }
          }}
        >
          Replace working guide
        </button>
        <button className="action-secondary" type="button" onClick={download}>
          Download private guide
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
