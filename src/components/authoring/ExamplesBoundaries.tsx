import type { DraftSpecification } from '../../domain/draft';
import { RepeatingFields, StringList, TextField } from './Fields';
export function ExamplesBoundaries({
  value,
  change,
  boundaries = false,
}: {
  value: DraftSpecification;
  change: (value: DraftSpecification) => void;
  boundaries?: boolean;
}) {
  if (boundaries)
    return (
      <>
        <TextField
          label="Privacy and data handling"
          value={value.safety.privacy}
          maximum={1800}
          help="Explain what users share with the model or external tools, retention concerns, and how to redact sensitive information."
          change={(privacy) => change({ ...value, safety: { ...value.safety, privacy } })}
        />
        <TextField
          label="Approval policy"
          value={value.safety.approval_policy}
          maximum={1800}
          change={(approval_policy) =>
            change({ ...value, safety: { ...value.safety, approval_policy } })
          }
        />
        <TextField
          label="Untrusted input policy"
          value={value.safety.untrusted_input_policy}
          maximum={1800}
          help="Explain how the agent treats instructions embedded in retrieved pages, documents or user-supplied data."
          change={(untrusted_input_policy) =>
            change({ ...value, safety: { ...value.safety, untrusted_input_policy } })
          }
        />
        <StringList
          label="Limitation"
          values={value.safety.limitations}
          maximum={12}
          change={(limitations) => change({ ...value, safety: { ...value.safety, limitations } })}
        />
        <StringList
          label="Prohibited action"
          values={value.safety.prohibited_actions}
          maximum={12}
          change={(prohibited_actions) =>
            change({ ...value, safety: { ...value.safety, prohibited_actions } })
          }
        />
      </>
    );
  return (
    <>
      <p>
        Use redacted, reproducible examples. Expected outputs describe intended behavior; they are
        not proof of observed host testing.
      </p>
      <RepeatingFields
        label="Example"
        items={value.examples}
        maximum={5}
        create={() => ({ title: '', input: '', expected_output: '', assertions: [] })}
        change={(examples) => change({ ...value, examples })}
      >
        {(item, _index, update) => (
          <>
            <TextField
              label="Example title"
              value={item.title}
              maximum={100}
              lines={1}
              change={(title) => update({ ...item, title })}
            />
            <TextField
              label="Example input"
              value={item.input}
              maximum={8000}
              lines={6}
              change={(input) => update({ ...item, input })}
            />
            <TextField
              label="Expected output"
              value={item.expected_output}
              maximum={12000}
              lines={8}
              change={(expected_output) => update({ ...item, expected_output })}
            />
            <StringList
              label="Assertion"
              values={item.assertions}
              maximum={12}
              change={(assertions) => update({ ...item, assertions })}
            />
          </>
        )}
      </RepeatingFields>
    </>
  );
}
