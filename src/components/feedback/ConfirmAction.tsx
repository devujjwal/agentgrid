'use client';
import { useId, useRef } from 'react';
import './confirm-action.css';

/** Native HTML dialog supplies focus trapping and Escape cancellation. The
 * explanation and affirmative action stay visible together before any change. */
export function ConfirmAction({
  label,
  title,
  description,
  confirmation,
  disabled,
  confirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmation: string;
  disabled?: boolean;
  confirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    id = useId();
  return (
    <>
      <button
        className="action-secondary"
        type="button"
        ref={trigger}
        disabled={disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="confirmation-dialog"
        aria-labelledby={id + '-title'}
        aria-describedby={id + '-description'}
        onClose={() => trigger.current?.focus()}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
          const first = buttons.item(0),
            last = buttons.item(buttons.length - 1);
          if (event.shiftKey && event.target === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && event.target === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h3 id={id + '-title'}>{title}</h3>
        <p id={id + '-description'}>{description}</p>
        <div className="confirmation-dialog-actions">
          <button
            className="action-secondary"
            autoFocus
            type="button"
            onClick={() => dialog.current?.close()}
          >
            Keep current state
          </button>
          <button
            className="action-primary"
            type="button"
            onClick={() => {
              dialog.current?.close();
              confirm();
            }}
          >
            {confirmation}
          </button>
        </div>
      </dialog>
    </>
  );
}
