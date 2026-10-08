'use client';
import { useState } from 'react';
import type { DraftEditorial } from '../../domain/draft-editorial';
import { CheckField, TextField } from './Fields';
import { guideReadinessIssues } from '../../domain/guide-readiness';
const declarations = [
  ['standalone_value', 'The guide provides useful context on its own.'],
  ['task_specific_instructions', 'The instructions are specific to the stated task.'],
  ['cost_disclosure', 'Platform and integration costs are clearly disclosed.'],
  ['security_and_privacy', 'Permissions, sensitive data and safety limits are explained.'],
  ['distribution_steps', 'The guide explains setup and how to use this resource.'],
  ['reuse_rights', 'I have checked that the stated reuse permissions are appropriate.'],
] as const;
export function GuideReadiness({
  value,
  change,
}: {
  value: DraftEditorial;
  change: (value: DraftEditorial) => void;
}) {
  const [result, setResult] = useState<{ fingerprint: string; issues: string[] } | null>(null);
  function inspect() {
    const issues = guideReadinessIssues(value);
    setResult({ fingerprint: JSON.stringify(value), issues });
  }
  return (
    <>
      <p>
        These are your readiness declarations. They do not approve publication or claim independent
        platform testing. Confirm only what you have actually checked.
      </p>
      <TextField
        label="Guide checked date"
        value={value.reviewed_on}
        change={(reviewed_on) => change({ ...value, reviewed_on })}
        maximum={10}
        lines={1}
        help="YYYY-MM-DD. Use the actual date of your review; leave blank until checked."
      />
      {declarations.map(([key, label]) => (
        <CheckField
          key={key}
          label={label}
          checked={value.review[key]}
          change={(checked) => change({ ...value, review: { ...value.review, [key]: checked } })}
        />
      ))}
      <button className="action-secondary" type="button" onClick={inspect}>
        Check guide readiness
      </button>
      {result && (
        <div role="status">
          {result.fingerprint !== JSON.stringify(value) ? (
            <p>The guide changed. Check readiness again.</p>
          ) : result.issues.length ? (
            <>
              <p>
                {result.issues.length} guide requirements need attention. An unfinished private
                guide can still be saved.
              </p>
              <ul>
                {result.issues.slice(0, 40).map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              The guide passes structural checks. Independent editorial, source, safety and real
              platform verification are still required for publication.
            </p>
          )}
        </div>
      )}
    </>
  );
}
