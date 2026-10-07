import type { DraftSpecification } from '../../domain/draft';
import { platformLabel } from '../../domain/platforms';
import { CheckField, ChoiceField, RepeatingFields, TextField } from './Fields';
export const platformChoices = ['chatgpt', 'claude', 'gemini', 'codex', 'cursor', 'n8n'].map(
  (value) => ({
    value: value as DraftSpecification['platforms'][number]['slug'],
    label: platformLabel(value),
  }),
);
export function PlatformFields({
  value,
  change,
}: {
  value: DraftSpecification;
  change: (value: DraftSpecification) => void;
}) {
  return (
    <>
      <p>
        These are intended platforms. Publication requires separate observed host tests for every
        claimed platform.
      </p>
      {platformChoices.map((platform) => (
        <CheckField
          key={platform.value}
          label={platform.label}
          checked={value.platforms.some((item) => item.slug === platform.value)}
          change={(selected) =>
            change({
              ...value,
              platforms: selected
                ? [
                    ...value.platforms,
                    {
                      slug: platform.value,
                      distribution: 'instructions',
                      setup_steps: [],
                      compatibility_notes: '',
                    },
                  ]
                : value.platforms.filter((item) => item.slug !== platform.value),
            })
          }
        />
      ))}
      {value.platforms.map((platform) => (
        <fieldset className="draft-entry" key={platform.slug}>
          <legend>{platformLabel(platform.slug)}</legend>
          <ChoiceField
            label="Distribution format"
            value={platform.distribution}
            change={(distribution) =>
              change({
                ...value,
                platforms: value.platforms.map((item) =>
                  item.slug === platform.slug ? { ...item, distribution } : item,
                ),
              })
            }
            choices={[
              { value: 'instructions', label: 'Copyable instructions' },
              { value: 'workflow', label: 'Importable workflow' },
              { value: 'package', label: 'Installable package' },
            ]}
          />
          <TextField
            label="Compatibility and account requirements"
            value={platform.compatibility_notes}
            maximum={1000}
            change={(compatibility_notes) =>
              change({
                ...value,
                platforms: value.platforms.map((item) =>
                  item.slug === platform.slug ? { ...item, compatibility_notes } : item,
                ),
              })
            }
          />
          <RepeatingFields
            label="Setup step"
            items={platform.setup_steps}
            maximum={10}
            create={() => ({ title: '', instructions: '' })}
            change={(setup_steps) =>
              change({
                ...value,
                platforms: value.platforms.map((item) =>
                  item.slug === platform.slug ? { ...item, setup_steps } : item,
                ),
              })
            }
          >
            {(step, _index, update) => (
              <>
                <TextField
                  label="Step title"
                  value={step.title}
                  maximum={100}
                  lines={1}
                  change={(title) => update({ ...step, title })}
                />
                <TextField
                  label="Setup instructions"
                  value={step.instructions}
                  maximum={1800}
                  change={(instructions) => update({ ...step, instructions })}
                />
              </>
            )}
          </RepeatingFields>
        </fieldset>
      ))}
      <TextField
        label="Platform costs"
        value={value.pricing.platform_costs}
        maximum={1200}
        help="Be explicit about subscriptions or usage charges. AgentGrid does not supply the runtime."
        change={(platform_costs) =>
          change({ ...value, pricing: { ...value.pricing, platform_costs } })
        }
      />
      <p>
        Workflow/package artifacts and their immutable checksums can be supplied through the
        portable definition import. Publication accepts only reviewed, delivered artifacts.
      </p>
    </>
  );
}
