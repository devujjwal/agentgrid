'use client';
import { useState } from 'react';
import { parseDraftSpecification, type DraftSpecification } from '../../domain/draft';
export function PortableDraft({
  value,
  change,
  inherited,
  readOnly = false,
}: {
  value: DraftSpecification;
  change: (value: DraftSpecification) => void;
  inherited: boolean;
  readOnly?: boolean;
}) {
  const [source, setSource] = useState(''),
    [error, setError] = useState<string | null>(null);
  function importDefinition() {
    setError(null);
    try {
      if (new TextEncoder().encode(source).byteLength > 100_000) throw new Error('Bounds');
      const imported = parseDraftSpecification(JSON.parse(source));
      if (imported.identity.slug !== value.identity.slug) throw new Error('Path');
      if (inherited && JSON.stringify(imported.license) !== JSON.stringify(value.license))
        throw new Error('License');
      change(imported);
      setSource('');
    } catch {
      setError(
        'Import refused. Use a bounded AgentGrid 0.1 definition with this resource path, valid permissions and the retained source license.',
      );
    }
  }
  function download() {
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = value.identity.slug + '.private-draft.agent.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  return (
    <details className="draft-portable">
      <summary>Portable definition · advanced</summary>
      <p>
        This is a private working definition. Downloading it does not publish, validate or grant
        additional reuse rights. Imported definitions cannot change this resource’s path or an
        inherited license.
      </p>
      <label htmlFor="draft-import">Paste an AgentGrid 0.1 JSON definition</label>
      <textarea
        id="draft-import"
        disabled={readOnly}
        value={source}
        onChange={(event) => setSource(event.target.value)}
        maxLength={100000}
        rows={10}
        spellCheck={false}
      />
      <div className="draft-portable-actions">
        <button
          type="button"
          className="action-secondary"
          disabled={readOnly || !source}
          onClick={importDefinition}
        >
          Replace working definition
        </button>
        <button type="button" className="action-secondary" onClick={download}>
          Download private definition
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
