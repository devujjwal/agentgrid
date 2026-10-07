import type { DraftSpecification } from '../../domain/draft';
import { CheckField, ChoiceField, RepeatingFields, TextField } from './Fields';
import { nextAuthoringIdentifier } from '../../domain/authoring-identifiers';
export function AccessFields({
  value,
  change,
}: {
  value: DraftSpecification;
  change: (value: DraftSpecification) => void;
}) {
  return (
    <>
      <h3>Requirements</h3>
      <RepeatingFields
        label="Requirement"
        items={value.requirements}
        maximum={16}
        create={() => ({
          id: nextAuthoringIdentifier(
            'requirement',
            value.requirements.map((item) => item.id),
          ),
          kind: 'input' as const,
          description: '',
          required: true,
        })}
        change={(requirements) => change({ ...value, requirements })}
      >
        {(item, _index, update) => (
          <>
            <TextField
              label="Requirement identifier"
              value={item.id}
              maximum={80}
              lines={1}
              change={(id) => update({ ...item, id })}
            />
            <ChoiceField
              label="Requirement kind"
              value={item.kind}
              choices={['input', 'integration', 'account', 'platform', 'runtime'].map((kind) => ({
                value: kind as typeof item.kind,
                label: kind,
              }))}
              change={(kind) => update({ ...item, kind })}
            />
            <TextField
              label="What is required"
              value={item.description}
              maximum={600}
              change={(description) => update({ ...item, description })}
            />
            <CheckField
              label="Required to use this agent"
              checked={item.required}
              change={(required) => update({ ...item, required })}
            />
          </>
        )}
      </RepeatingFields>
      <h3>Tools and connections</h3>
      <RepeatingFields
        label="Tool"
        items={value.tools}
        maximum={16}
        create={() => ({
          id: nextAuthoringIdentifier(
            'tool',
            value.tools.map((item) => item.id),
          ),
          kind: 'integration' as const,
          purpose: '',
        })}
        change={(tools) => change({ ...value, tools })}
      >
        {(item, _index, update) => (
          <>
            <TextField
              label="Tool identifier"
              value={item.id}
              maximum={80}
              lines={1}
              change={(id) => update({ ...item, id })}
            />
            <ChoiceField
              label="Tool kind"
              value={item.kind}
              choices={[
                { value: 'mcp', label: 'MCP server' },
                { value: 'integration', label: 'Integration' },
                { value: 'built-in', label: 'Platform built-in tool' },
              ]}
              change={(kind) => update({ ...item, kind })}
            />
            <TextField
              label="Tool purpose"
              value={item.purpose}
              maximum={600}
              change={(purpose) => update({ ...item, purpose })}
            />
            <TextField
              label="Linked requirement identifier (optional)"
              value={item.requirement_id ?? ''}
              maximum={80}
              lines={1}
              change={(requirement_id) => {
                const { requirement_id: previous, ...remaining } = item;
                void previous;
                update(requirement_id ? { ...remaining, requirement_id } : remaining);
              }}
            />
          </>
        )}
      </RepeatingFields>
      <h3>Permissions</h3>
      <p>
        Declare every external resource the agent accesses. Write actions always require approval.
      </p>
      <RepeatingFields
        label="Permission"
        items={value.permissions}
        maximum={16}
        create={() => ({
          resource: '',
          operation: 'read' as const,
          justification: '',
          confirmation_required: false,
        })}
        change={(permissions) => change({ ...value, permissions })}
      >
        {(item, _index, update) => (
          <>
            <TextField
              label="Resource accessed"
              value={item.resource}
              maximum={120}
              lines={1}
              change={(resource) => update({ ...item, resource })}
            />
            <ChoiceField
              label="Operation"
              value={item.operation}
              choices={[
                { value: 'read', label: 'Read' },
                { value: 'write', label: 'Write — approval required' },
                { value: 'network', label: 'Network access' },
              ]}
              change={(operation) =>
                update({
                  ...item,
                  operation,
                  confirmation_required: operation === 'write' || item.confirmation_required,
                })
              }
            />
            <TextField
              label="Why this access is needed"
              value={item.justification}
              maximum={600}
              change={(justification) => update({ ...item, justification })}
            />
            {item.operation === 'write' ? (
              <p>Explicit approval is required before writes.</p>
            ) : (
              <CheckField
                label="Require user approval"
                checked={item.confirmation_required}
                change={(confirmation_required) => update({ ...item, confirmation_required })}
              />
            )}
          </>
        )}
      </RepeatingFields>
    </>
  );
}
