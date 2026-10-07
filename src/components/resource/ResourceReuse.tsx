import type { AgentSpecification } from '../../domain/agent-specification';
import Link from 'next/link';
import type { PublicResource } from '../../domain/public-resource';

export function ResourceReuse({
  specification: spec,
  publication,
}: {
  specification: AgentSpecification;
  publication: PublicResource | null;
}) {
  return (
    <section className="resource-section" id="reuse">
      <h2>Make it yours, with clear terms.</h2>
      <p>
        <strong>
          {spec.license.identifier === 'unselected'
            ? 'Reuse terms not yet selected'
            : spec.license.identifier}
        </strong>
      </p>
      <p>{spec.license.statement}</p>
      {spec.license.url && (
        <a href={spec.license.url} rel="nofollow noopener noreferrer">
          Read the package license
        </a>
      )}
      {publication && (
        <dl className="reuse-ledger">
          {Object.entries(spec.license.permissions).map(([key, value]) => (
            <div key={key}>
              <dt>{key.replaceAll('_', ' ')}</dt>
              <dd>{value ? 'Permitted under the stated terms' : 'Not permitted'}</dd>
            </div>
          ))}
        </dl>
      )}
      {publication?.lineage.length ? (
        <>
          <h3>Fork attribution</h3>
          <ol>
            {publication.lineage.map((source, index) => (
              <li key={index}>
                {source.source_available ? (
                  <Link prefetch={false} href={`/agents/${source.source_slug}/`}>
                    {source.source_slug}
                  </Link>
                ) : (
                  <span>{source.source_slug} (source unavailable)</span>
                )}{' '}
                · version {source.source_version} · {source.creator_name}
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
