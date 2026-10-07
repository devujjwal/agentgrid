'use client';
import type { FormEvent } from 'react';
import { categoryChoices } from './IntentBehavior';
import { platformChoices } from './PlatformFields';
export interface NewAgentFields {
  name: string;
  slug: string;
  category: string;
  platform: string;
}
export const blankAgentFields: NewAgentFields = { name: '', slug: '', category: '', platform: '' };
export function NewAgentForm({
  fields,
  change,
  busy,
  create,
}: {
  fields: NewAgentFields;
  change: (fields: NewAgentFields) => void;
  busy: boolean;
  create: () => void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    create();
  }
  return (
    <section className="draft-new identity-panel" aria-labelledby="new-agent-title">
      <p className="eyebrow">New connection / private by default</p>
      <h2 id="new-agent-title">Give a useful idea a home.</h2>
      <p>
        Choose its identity first. You can save unfinished instructions, examples and setup in your
        private workspace.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label htmlFor="agent-name">Agent name</label>
          <input
            id="agent-name"
            required
            minLength={4}
            maxLength={100}
            value={fields.name}
            onChange={(event) => change({ ...fields, name: event.target.value })}
          />
          <label htmlFor="agent-slug">Resource path</label>
          <input
            id="agent-slug"
            required
            minLength={3}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            aria-describedby="agent-path-help"
            value={fields.slug}
            onChange={(event) => change({ ...fields, slug: event.target.value })}
          />
          <p id="agent-path-help">
            Use lowercase words separated by hyphens. This path is fixed after creation; it becomes
            public only after publication.
          </p>
          <label htmlFor="agent-category">Category</label>
          <select
            id="agent-category"
            value={fields.category}
            onChange={(event) => change({ ...fields, category: event.target.value })}
            required
          >
            <option value="">Choose a category</option>
            {categoryChoices.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <label htmlFor="agent-platform">First intended platform</label>
          <select
            id="agent-platform"
            value={fields.platform}
            onChange={(event) => change({ ...fields, platform: event.target.value })}
            required
          >
            <option value="">Choose a platform</option>
            {platformChoices.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <p>
            Choosing a platform is an intention, not a verified compatibility claim. No reuse rights
            are granted until you deliberately select terms.
          </p>
          <button type="submit" className="action-primary">
            {busy ? 'Creating…' : 'Create private draft'}
            <span aria-hidden="true">↗</span>
          </button>
        </fieldset>
      </form>
    </section>
  );
}
