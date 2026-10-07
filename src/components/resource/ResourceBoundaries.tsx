import type { AgentSpecification } from '../../domain/agent-specification';

export function ResourceBoundaries({ specification: spec }: { specification: AgentSpecification }) {
  return (
    <section className="resource-section" id="boundaries">
      <h2>Limits, privacy and authority.</h2>
      <ul>
        {spec.safety.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h3>Privacy</h3>
      <p>{spec.safety.privacy}</p>
      <h3>Before taking action</h3>
      <p>{spec.safety.approval_policy}</p>
      <h3>Untrusted material</h3>
      <p>{spec.safety.untrusted_input_policy}</p>
      <h3>Permission boundaries</h3>
      <ul>
        {spec.permissions.map((item, index) => (
          <li key={index}>
            <strong>
              {item.operation} — {item.resource}:
            </strong>{' '}
            {item.justification}
            {item.confirmation_required ? ' Explicit confirmation is required.' : ''}
          </li>
        ))}
      </ul>
      <h3>Prohibited actions</h3>
      <ul>
        {spec.safety.prohibited_actions.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
