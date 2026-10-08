'use client';
import { HostRunSchema, type HostVerificationRun } from '../../domain/host-verification';
import { ConfirmAction } from '../feedback/ConfirmAction';
export function HostEvidenceForm({
  value,
  platforms,
  change,
  disabled,
  attested,
  setAttested,
  record,
}: {
  value: HostVerificationRun;
  platforms: string[];
  change: (value: HostVerificationRun) => void;
  disabled: boolean;
  attested: boolean;
  setAttested: (value: boolean) => void;
  record: () => void;
}) {
  const parsed = HostRunSchema.safeParse(value);
  const update = <K extends keyof HostVerificationRun>(key: K, next: HostVerificationRun[K]) =>
    change({ ...value, [key]: next });
  return (
    <section className="moderation-decision" aria-labelledby="host-record-title">
      <h3 id="host-record-title">Record an observed run.</h3>
      <p>
        Use the exact submitted instructions on the named host. Record redacted input and the actual
        output, including failures. Examples, expected outputs and generated demonstrations are not
        verification evidence.
      </p>
      <fieldset className="moderation-fields" disabled={disabled}>
        <legend>Host and scenario</legend>
        <label htmlFor="host-platform">Platform tested</label>
        <select
          id="host-platform"
          value={value.platform_slug}
          onChange={(event) => update('platform_slug', event.target.value)}
        >
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>
        <label htmlFor="host-scenario">Scenario</label>
        <select
          id="host-scenario"
          value={value.scenario}
          onChange={(event) =>
            update('scenario', event.target.value as HostVerificationRun['scenario'])
          }
        >
          <option value="normal">Normal task</option>
          <option value="ambiguous-input">Ambiguous input</option>
          <option value="adversarial-input">Adversarial input</option>
        </select>
        <label htmlFor="host-version">Host and model version</label>
        <input
          id="host-version"
          value={value.host_version}
          maxLength={160}
          onChange={(event) => update('host_version', event.target.value)}
          aria-describedby="host-version-help"
        />
        <p id="host-version-help">
          Record the actual product/model shown during testing. 3–160 characters.
        </p>
        <label htmlFor="host-date">Date tested</label>
        <input
          id="host-date"
          type="date"
          value={value.completed_on}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(event) => update('completed_on', event.target.value)}
        />
        <label htmlFor="host-input">Redacted input</label>
        <textarea
          id="host-input"
          rows={5}
          value={value.input}
          maxLength={8000}
          onChange={(event) => update('input', event.target.value)}
          aria-describedby="host-input-help"
        />
        <p id="host-input-help">
          80–8,000 characters. Remove credentials and unrelated personal information before
          recording.
        </p>
        <label htmlFor="host-output">Observed output</label>
        <textarea
          id="host-output"
          rows={7}
          value={value.observed_output}
          maxLength={16000}
          onChange={(event) => update('observed_output', event.target.value)}
          aria-describedby="host-output-help"
        />
        <p id="host-output-help">
          80–16,000 characters. Preserve the actual result and errors; do not replace them with a
          better answer.
        </p>
      </fieldset>
      <fieldset className="moderation-fields" disabled={disabled}>
        <legend>Assertions checked against the output</legend>
        <p>At least two specific checks. Mark passed only after inspecting the observed result.</p>
        {value.assertions.map((assertion, index) => (
          <div className="host-assertion" key={index}>
            <label htmlFor={'host-assertion-' + index}>Check {index + 1}</label>
            <textarea
              id={'host-assertion-' + index}
              rows={2}
              value={assertion.description}
              maxLength={600}
              onChange={(event) =>
                update(
                  'assertions',
                  value.assertions.map((item, i) =>
                    i === index ? { ...item, description: event.target.value } : item,
                  ),
                )
              }
            />
            <label className="moderation-choice">
              <input
                type="checkbox"
                checked={assertion.passed}
                onChange={(event) =>
                  update(
                    'assertions',
                    value.assertions.map((item, i) =>
                      i === index ? { ...item, passed: event.target.checked } : item,
                    ),
                  )
                }
              />
              Check {index + 1} passed
            </label>
            <p>Describe the observable criterion in 24–600 characters.</p>
          </div>
        ))}
        {value.assertions.length < 12 && (
          <button
            type="button"
            className="action-secondary"
            onClick={() =>
              update('assertions', [...value.assertions, { description: '', passed: false }])
            }
          >
            Add another check
          </button>
        )}
        {value.assertions.length > 2 && (
          <button
            type="button"
            className="action-secondary"
            onClick={() => update('assertions', value.assertions.slice(0, -1))}
          >
            Remove last check
          </button>
        )}
        <label htmlFor="host-notes">Reviewer notes</label>
        <textarea
          id="host-notes"
          rows={4}
          value={value.reviewer_notes}
          maxLength={1600}
          onChange={(event) => update('reviewer_notes', event.target.value)}
          aria-describedby="host-notes-help"
        />
        <p id="host-notes-help">
          80–1,600 characters. Explain what the result supports, any failures and the limits of this
          test.
        </p>
        <label className="moderation-choice">
          <input
            type="checkbox"
            checked={attested}
            onChange={(event) => setAttested(event.target.checked)}
          />
          I inspected this actual host run and redacted private information.
        </label>
      </fieldset>
      {!parsed.success && (
        <p>
          Complete every field to its stated length, choose a valid date and describe at least two
          checks before recording.
        </p>
      )}
      <ConfirmAction
        label="Review evidence record"
        title="Retain this private observation?"
        description="This creates an immutable private evidence record. It does not approve a release or claim that every check passed. Corrections require a new record; redact sensitive information before continuing."
        confirmation="Record observed run"
        disabled={disabled || !parsed.success || !attested}
        confirm={record}
      />
    </section>
  );
}
