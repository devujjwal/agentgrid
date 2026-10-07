import type { DraftSpecification } from '../../domain/draft';
import { TextField, ChoiceField, RepeatingFields } from './Fields';
import { categoryLabel } from '../discovery/ResourceInspector';
import { nextAuthoringIdentifier } from '../../domain/authoring-identifiers';
export const categoryChoices = [
  'marketing',
  'productivity',
  'research',
  'education',
  'content',
  'ecommerce',
  'business-operations',
  'everyday',
  'seo',
  'development',
].map((value) => ({
  value,
  label:
    value === 'everyday'
      ? 'Everyday life'
      : categoryLabel(value).replace(/^./, (letter) => letter.toUpperCase()),
}));
export function IntentBehavior({
  value,
  change,
  behavior = false,
}: {
  value: DraftSpecification;
  change: (value: DraftSpecification) => void;
  behavior?: boolean;
}) {
  if (!behavior)
    return (
      <>
        <TextField
          label="Agent name"
          value={value.identity.name}
          change={(name) => change({ ...value, identity: { ...value.identity, name } })}
          maximum={100}
          lines={1}
        />
        <TextField
          label="One-sentence summary"
          value={value.identity.summary}
          change={(summary) => change({ ...value, identity: { ...value.identity, summary } })}
          maximum={300}
          help="Explain the useful result in plain language. Published summaries need 60–300 characters."
        />
        <TextField
          label="Purpose and audience"
          value={value.purpose}
          change={(purpose) => change({ ...value, purpose })}
          maximum={1800}
          help="Who benefits, what problem does it solve, and when should someone choose it?"
          lines={5}
        />
        <ChoiceField
          label="Category"
          value={value.category}
          choices={categoryChoices}
          change={(category) => change({ ...value, category })}
        />
        <TextField
          label="Package version"
          value={value.version}
          change={(version) => change({ ...value, version })}
          maximum={24}
          lines={1}
          help="Use major.minor.patch, for example 0.1.0. Submitted versions cannot be overwritten."
        />
        <p className="draft-path">
          Resource path: <code>/agents/{value.identity.slug}/</code>
          <br />
          The path is fixed after creation.
        </p>
      </>
    );
  return (
    <>
      <TextField
        label="System instructions"
        value={value.execution.instructions}
        change={(instructions) =>
          change({ ...value, execution: { ...value.execution, instructions } })
        }
        maximum={24000}
        lines={14}
        help="Describe the task, process, outputs and stopping conditions. Do not include passwords, API keys or private user data."
      />
      <ChoiceField
        label="Execution mode"
        value={value.execution.mode}
        change={(mode) => change({ ...value, execution: { ...value.execution, mode } })}
        choices={[
          { value: 'interactive', label: 'Interactive instructions' },
          { value: 'scheduled-workflow', label: 'Scheduled workflow' },
          { value: 'event-workflow', label: 'Event-triggered workflow' },
        ]}
      />
      <ChoiceField
        label="Action boundary"
        value={value.execution.autonomy}
        change={(autonomy) => change({ ...value, execution: { ...value.execution, autonomy } })}
        choices={[
          { value: 'assistive', label: 'Assistive — provide a result for the user' },
          { value: 'review-before-action', label: 'Review before action' },
        ]}
      />
      <RepeatingFields
        label="Capability"
        items={value.capabilities}
        maximum={12}
        change={(capabilities) => change({ ...value, capabilities })}
        create={() => ({
          id: nextAuthoringIdentifier(
            'capability',
            value.capabilities.map((item) => item.id),
          ),
          name: '',
          description: '',
        })}
      >
        {(item, _index, update) => (
          <>
            <TextField
              label="Capability identifier"
              value={item.id}
              maximum={80}
              lines={1}
              change={(id) => update({ ...item, id })}
            />
            <TextField
              label="Capability name"
              value={item.name}
              maximum={100}
              lines={1}
              change={(name) => update({ ...item, name })}
            />
            <TextField
              label="What it does"
              value={item.description}
              maximum={600}
              change={(description) => update({ ...item, description })}
            />
          </>
        )}
      </RepeatingFields>
    </>
  );
}
