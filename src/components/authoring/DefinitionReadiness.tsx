'use client';
import { useState } from 'react';
import type { DraftSpecification } from '../../domain/draft';
import { formatAuthoringIssue } from '../../domain/authoring-issues';
import {
  AgentSpecificationSchema,
  assertJsonDocumentBounds,
} from '../../domain/agent-specification';
export function DefinitionReadiness({ value }: { value: DraftSpecification }) {
  const [readiness, setReadiness] = useState<{ fingerprint: string; issues: string[] } | null>(
    null,
  );
  function checkReadiness() {
    let issues: string[];
    try {
      assertJsonDocumentBounds(value);
      const parsed = AgentSpecificationSchema.safeParse(value);
      issues = parsed.success ? [] : parsed.error.issues.map(formatAuthoringIssue);
      if (value.license.identifier === 'unselected' || !value.license.permissions.use)
        issues.push('Reuse terms: an explicit license permitting use is needed for submission.');
    } catch {
      issues = ['Definition exceeds safe document bounds.'];
    }
    setReadiness({ fingerprint: JSON.stringify(value), issues });
  }
  return (
    <section className="draft-readiness" aria-labelledby="readiness-title">
      <h3 id="readiness-title">Before it becomes a public resource.</h3>
      <p>
        Checking the definition does not establish host-test or editorial quality. Publication
        requires both.
      </p>
      <button type="button" className="action-secondary" onClick={checkReadiness}>
        Check definition readiness
      </button>
      {readiness &&
        (readiness.fingerprint === JSON.stringify(value) ? (
          <div role="status">
            {readiness.issues.length ? (
              <>
                <p>
                  {readiness.issues.length} definition requirements need attention. You can still
                  save an unfinished private draft when its identity, permissions and document
                  bounds are valid.
                </p>
                <ul>
                  {readiness.issues.slice(0, 40).map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                The portable definition passes structural checks. Editorial review and real host
                testing are still required.
              </p>
            )}
          </div>
        ) : (
          <p role="status">The definition changed. Check readiness again.</p>
        ))}
    </section>
  );
}
