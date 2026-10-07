'use client';
import { useId, useRef, type ReactNode } from 'react';

export function TextField({
  label,
  value,
  change,
  maximum,
  help,
  lines = 3,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
  maximum: number;
  help?: string;
  lines?: number;
}) {
  const id = useId();
  return (
    <div className="draft-field">
      <label htmlFor={id}>{label}</label>
      {help && <p id={id + '-help'}>{help}</p>}
      {lines === 1 ? (
        <input
          id={id}
          value={value}
          onChange={(event) => change(event.target.value)}
          maxLength={maximum}
          aria-describedby={help ? id + '-help' : undefined}
        />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(event) => change(event.target.value)}
          maxLength={maximum}
          rows={lines}
          aria-describedby={help ? id + '-help' : undefined}
        />
      )}
    </div>
  );
}
export function ChoiceField<T extends string>({
  label,
  value,
  change,
  choices,
}: {
  label: string;
  value: T;
  change: (value: T) => void;
  choices: readonly { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className="draft-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const selected = choices.find((item) => item.value === event.target.value);
          if (selected) change(selected.value);
        }}
      >
        {choices.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
export function CheckField({
  label,
  checked,
  change,
}: {
  label: string;
  checked: boolean;
  change: (value: boolean) => void;
}) {
  return (
    <label className="draft-check">
      <input type="checkbox" checked={checked} onChange={(event) => change(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
export function RepeatingFields<T>({
  label,
  items,
  maximum,
  create,
  change,
  children,
}: {
  label: string;
  items: T[];
  maximum: number;
  create: (index: number) => NoInfer<T>;
  change: (items: NoInfer<T>[]) => void;
  children: (item: T, index: number, update: (item: T) => void) => ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  return (
    <div className="draft-repeat" ref={container}>
      {items.map((item, index) => (
        <fieldset key={index} className="draft-entry">
          <legend>
            {label} {index + 1}
          </legend>
          {children(item, index, (next) =>
            change(items.map((existing, position) => (position === index ? next : existing))),
          )}
          <button
            type="button"
            className="draft-text-action"
            onClick={() => {
              change(items.filter((_, position) => position !== index));
              requestAnimationFrame(() => addButton.current?.focus());
            }}
          >
            Remove {label.toLowerCase()} {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        ref={addButton}
        className="action-secondary"
        disabled={items.length >= maximum}
        onClick={() => {
          change([...items, create(items.length)]);
          requestAnimationFrame(() => {
            const entries = container.current?.querySelectorAll('.draft-entry');
            entries?.[entries.length - 1]
              ?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
                'input:not(:disabled),textarea:not(:disabled),select:not(:disabled)',
              )
              ?.focus();
          });
        }}
      >
        Add {label.toLowerCase()} <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
export function StringList({
  label,
  values,
  change,
  maximum,
  length = 600,
}: {
  label: string;
  values: string[];
  change: (values: string[]) => void;
  maximum: number;
  length?: number;
}) {
  return (
    <RepeatingFields
      label={label}
      items={values}
      maximum={maximum}
      create={() => ''}
      change={change}
    >
      {(value, index, update) => (
        <TextField
          label={label + ' ' + (index + 1)}
          value={value}
          change={update}
          maximum={length}
        />
      )}
    </RepeatingFields>
  );
}
