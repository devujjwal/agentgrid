import type { AgentSpecification } from '../../domain/agent-specification';

export function ResourceExamples({ specification: spec }: { specification: AgentSpecification }) {
  return (
    <section className="resource-section" id="examples">
      <h2>Know what good looks like.</h2>
      <p>
        Illustrative inputs and expected behavior. These are examples, not transcripts of actual
        host runs.
      </p>
      {spec.examples.map((example) => (
        <details className="example-disclosure" key={example.title}>
          <summary>{example.title}</summary>
          <h3>Input</h3>
          <pre>{example.input}</pre>
          <h3>Expected behavior</h3>
          <p>{example.expected_output}</p>
          <h3>Check the result</h3>
          <ul>
            {example.assertions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
