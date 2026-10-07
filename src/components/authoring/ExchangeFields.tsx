import type { DraftSpecification } from '../../domain/draft';
import { CheckField, ChoiceField, RepeatingFields, TextField } from './Fields';
import { nextAuthoringIdentifier } from '../../domain/authoring-identifiers';
const formats = ['text', 'csv', 'json', 'url', 'file'].map((value) => ({
  value: value as DraftSpecification['inputs'][number]['format'],
  label: value.toUpperCase(),
}));
export function ExchangeFields({
  value,
  change,
}: {
  value: DraftSpecification;
  change: (value: DraftSpecification) => void;
}) {
  return (
    <>
      <h3>What people provide</h3>
      <RepeatingFields
        label="Input"
        items={value.inputs}
        maximum={12}
        create={() => ({
          name: nextAuthoringIdentifier(
            'input',
            value.inputs.map((item) => item.name),
          ),
          label: '',
          description: '',
          format: 'text' as const,
          required: true,
          contains_sensitive_data: false,
        })}
        change={(inputs) => change({ ...value, inputs })}
      >
        {(item, _index, update) => (
          <>
            <TextField
              label="Input identifier"
              value={item.name}
              change={(name) => update({ ...item, name })}
              maximum={80}
              lines={1}
            />
            <TextField
              label="Input label"
              value={item.label}
              change={(label) => update({ ...item, label })}
              maximum={100}
              lines={1}
            />
            <TextField
              label="What to provide"
              value={item.description}
              change={(description) => update({ ...item, description })}
              maximum={600}
            />
            <ChoiceField
              label="Input format"
              value={item.format}
              change={(format) => update({ ...item, format })}
              choices={formats}
            />
            <CheckField
              label="This input is required"
              checked={item.required}
              change={(required) => update({ ...item, required })}
            />
            <CheckField
              label="This input may contain sensitive data"
              checked={item.contains_sensitive_data}
              change={(contains_sensitive_data) => update({ ...item, contains_sensitive_data })}
            />
          </>
        )}
      </RepeatingFields>
      <h3>What the agent returns</h3>
      <RepeatingFields
        label="Output"
        items={value.outputs}
        maximum={12}
        create={() => ({
          name: nextAuthoringIdentifier(
            'output',
            value.outputs.map((item) => item.name),
          ),
          label: '',
          description: '',
          format: 'text' as const,
        })}
        change={(outputs) => change({ ...value, outputs })}
      >
        {(item, _index, update) => (
          <>
            <TextField
              label="Output identifier"
              value={item.name}
              change={(name) => update({ ...item, name })}
              maximum={80}
              lines={1}
            />
            <TextField
              label="Output label"
              value={item.label}
              change={(label) => update({ ...item, label })}
              maximum={100}
              lines={1}
            />
            <TextField
              label="Expected result"
              value={item.description}
              change={(description) => update({ ...item, description })}
              maximum={600}
            />
            <ChoiceField
              label="Output format"
              value={item.format}
              change={(format) => update({ ...item, format })}
              choices={formats}
            />
          </>
        )}
      </RepeatingFields>
    </>
  );
}
