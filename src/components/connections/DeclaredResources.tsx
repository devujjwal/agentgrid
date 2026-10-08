import Link from 'next/link';
import type { ResourceDocument } from '../../data/resources';
import type { ConnectionKind } from '../../domain/connection-guide';
export function DeclaredResources({
  kind,
  resources,
}: {
  kind: ConnectionKind;
  resources: ResourceDocument[];
}) {
  return (
    <>
      {kind !== 'mcp' && (
        <section>
          <h2>Resources that declare this {kind}.</h2>
          <p>
            Showing {Math.min(resources.length, 8)} of {resources.length} resources with this
            declared requirement. Open the resource to check its publication status, exact setup,
            version and verification evidence.
          </p>
          {resources.length ? (
            <ul className="discipline-resources">
              {resources.slice(0, 8).map(({ specification: spec, publication }) => (
                <li key={spec.identity.slug}>
                  <span className="eyebrow">
                    {publication
                      ? 'Published resource'
                      : 'Unpublished draft · host testing pending'}
                  </span>
                  <h3>
                    <Link prefetch={false} href={`/agents/${spec.identity.slug}/`}>
                      {spec.identity.name} ↗
                    </Link>
                  </h3>
                  <p>{spec.identity.summary}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No published resources currently declare this {kind}. General guidance is not a
              promise that an agent supports it.
            </p>
          )}
          {resources.length > 8 && (
            <p>
              <Link prefetch={false} href="/agents/">
                Browse all agents ↗
              </Link>
            </p>
          )}
        </section>
      )}
    </>
  );
}
