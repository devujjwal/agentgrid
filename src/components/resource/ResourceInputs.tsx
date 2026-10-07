import type { AgentSpecification } from '../../domain/agent-specification';

export function ResourceInputs({ specification: spec }: { specification: AgentSpecification }) {
  return (
    <section className="resource-section" id="requirements">
      <h2>What you’ll need.</h2>
      <ul>
        {spec.requirements.map((item) => (
          <li key={item.id}>
            <strong>{item.required ? 'Required' : 'Optional'}:</strong> {item.description}
          </li>
        ))}
      </ul>
      <h3>Input</h3>
      <dl className="io-ledger">
        {spec.inputs.map((item) => (
          <div key={item.name}>
            <dt>
              {item.label} {item.required ? '(required)' : '(optional)'}
            </dt>
            <dd>
              {item.description}
              {item.contains_sensitive_data && (
                <span className="privacy-note">
                  Share only authorized, appropriately redacted material.
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <h3>Output</h3>
      <dl className="io-ledger">
        {spec.outputs.map((item) => (
          <div key={item.name}>
            <dt>{item.label}</dt>
            <dd>{item.description}</dd>
          </div>
        ))}
      </dl>
      {spec.tools.length > 0 && (
        <>
          <h3>Tools and integrations</h3>
          <ul>
            {spec.tools.map((item) => (
              <li key={item.id}>
                {item.kind}: {item.purpose}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
