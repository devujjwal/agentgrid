import type { DraftSpecification } from '../../domain/draft';
import { CheckField, ChoiceField, TextField } from './Fields';
export function ReuseFields({
  value,
  change,
  inherited,
}: {
  value: DraftSpecification;
  change: (value: DraftSpecification) => void;
  inherited: boolean;
}) {
  const license = value.license;
  return (
    <>
      <p>
        {inherited
          ? 'This fork retains the source license and attribution. Guided editing cannot erase or replace its reuse conditions.'
          : 'Private drafts begin without a reuse grant. Choose permissions deliberately; AgentGrid never applies an open license automatically.'}
      </p>
      <fieldset disabled={inherited}>
        <ChoiceField
          label="Package license"
          value={license.identifier}
          choices={[
            'unselected',
            'CC-BY-4.0',
            'CC0-1.0',
            'MIT',
            'custom',
            'all-rights-reserved',
          ].map((identifier) => ({
            value: identifier as typeof license.identifier,
            label: identifier === 'unselected' ? 'No license selected' : identifier,
          }))}
          change={(identifier) => {
            const open = ['CC-BY-4.0', 'CC0-1.0', 'MIT'].includes(identifier);
            const permissions = { use: open, modify: open, redistribute: open, public_fork: open };
            change({
              ...value,
              license: {
                identifier,
                permissions,
                statement:
                  identifier === 'unselected'
                    ? 'Reuse terms have not been selected. This private draft grants no reuse permissions.'
                    : '',
              },
            });
          }}
        />
        <TextField
          label="License statement"
          value={license.statement}
          maximum={1600}
          help="Describe the selected terms, attribution and any conditions. The statement must be explicit before saving a selected license."
          change={(statement) => change({ ...value, license: { ...license, statement } })}
        />
        <TextField
          label="License terms URL (optional, HTTPS)"
          value={license.url ?? ''}
          maximum={2048}
          lines={1}
          change={(url) => {
            const { url: previous, ...remaining } = license;
            void previous;
            change({ ...value, license: url ? { ...remaining, url } : remaining });
          }}
        />
        <p>
          {['CC-BY-4.0', 'CC0-1.0', 'MIT'].includes(license.identifier)
            ? 'The selected standard open license grants use, modification, redistribution and public forks. Review its terms before publication.'
            : 'Select only permissions your terms allow. Public forks require all four permissions.'}
        </p>
        <fieldset
          disabled={
            license.identifier === 'unselected' ||
            ['CC-BY-4.0', 'CC0-1.0', 'MIT'].includes(license.identifier)
          }
        >
          <CheckField
            label="Allow use"
            checked={license.permissions.use}
            change={(use) =>
              change({
                ...value,
                license: { ...license, permissions: { ...license.permissions, use } },
              })
            }
          />
          <CheckField
            label="Allow modification"
            checked={license.permissions.modify}
            change={(modify) =>
              change({
                ...value,
                license: { ...license, permissions: { ...license.permissions, modify } },
              })
            }
          />
          {license.identifier !== 'all-rights-reserved' && (
            <>
              <CheckField
                label="Allow redistribution"
                checked={license.permissions.redistribute}
                change={(redistribute) =>
                  change({
                    ...value,
                    license: { ...license, permissions: { ...license.permissions, redistribute } },
                  })
                }
              />
              <CheckField
                label="Allow public forks"
                checked={license.permissions.public_fork}
                change={(public_fork) =>
                  change({
                    ...value,
                    license: { ...license, permissions: { ...license.permissions, public_fork } },
                  })
                }
              />
            </>
          )}
        </fieldset>
      </fieldset>
    </>
  );
}
