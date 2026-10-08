import { AgentSpecificationSchema } from '../../domain/agent-specification';
import { EditorialSchema } from '../../domain/editorial';
import type { StaffSubmission } from '../../domain/submission-moderation';
function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
/** Untrusted submitted JSON is displayed as text, never as executable markup. */
export function SubmissionDocument({ submission }: { submission: StaffSubmission }) {
  const specification = AgentSpecificationSchema.safeParse(parse(submission.specificationText));
  const editorial = EditorialSchema.safeParse(parse(submission.editorialText));
  return (
    <section className="moderation-context" aria-labelledby="submission-document-title">
      <p className="eyebrow">Frozen at submission / content inspection</p>
      <h3 id="submission-document-title">The version under review.</h3>
      <p>
        These documents belong to this immutable version. Later changes to the creator’s working
        draft are separate.
      </p>
      <dl className="moderation-facts">
        <div>
          <dt>Definition structure</dt>
          <dd>{specification.success ? 'Complete' : 'Needs changes'}</dd>
        </div>
        <div>
          <dt>Public guide structure</dt>
          <dd>{editorial.success ? 'Complete' : 'Needs changes'}</dd>
        </div>
        <div>
          <dt>Resource status</dt>
          <dd>{submission.resourceStatus}</dd>
        </div>
        <div>
          <dt>Creator status</dt>
          <dd>{submission.authorStatus}</dd>
        </div>
      </dl>
      <p>
        Structure checks do not establish accuracy, safety, rights or successful use. Publication
        requires independent editorial and platform evidence.
      </p>
      {specification.success && (
        <>
          <h4>Purpose</h4>
          <p>{specification.data.purpose}</p>
        </>
      )}
      {editorial.success && (
        <>
          <h4>Submitted overview</h4>
          <p className="moderation-prose">{editorial.data.overview}</p>
        </>
      )}
      {(
        [
          ['Portable definition', submission.specificationText, specification],
          ['Public guide', submission.editorialText, editorial],
        ] as const
      ).map(([label, text, result]) => (
        <details key={label}>
          <summary>{label} — full submitted document</summary>
          {!result.success && (
            <div>
              <h4>Structure issues</h4>
              <ul>
                {result.error.issues.slice(0, 20).map((issue, index) => (
                  <li key={index}>
                    {issue.path.join('.') || 'Document'}: {issue.message}
                  </li>
                ))}
              </ul>
              {result.error.issues.length > 20 && (
                <p>Showing the first 20 issues. Review the complete document below.</p>
              )}
            </div>
          )}
          <pre className="moderation-code">{text}</pre>
        </details>
      ))}
      <details>
        <summary>Version and attribution references</summary>
        <p className="moderation-prose">
          Content digest: {submission.contentDigest}
          <br />
          Version: {submission.versionId}
          <br />
          Resource: {submission.resourceId}
          <br />
          Source version: {submission.sourceVersionId ?? 'Original submission'}
        </p>
      </details>
    </section>
  );
}
