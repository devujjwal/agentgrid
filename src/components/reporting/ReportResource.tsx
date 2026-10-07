'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { ReportInput } from '../../domain/reports';
const ReportForm = dynamic(() => import('./ReportForm').then((module) => module.ReportForm), {
  loading: () => <p role="status">Opening private reporting…</p>,
});
/** Authentication and reporting code load only after deliberate interaction. */
export function ReportResource(props: {
  targetId: string;
  targetKind: ReportInput['targetKind'];
  label: string;
  path: string;
}) {
  const [open, setOpen] = useState(false),
    [engaged, setEngaged] = useState(false);
  const id = 'report-resource-' + props.targetKind + '-' + props.targetId;
  return (
    <section className="report-resource" aria-label="Report a resource concern">
      <button
        className="action-secondary"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => {
          setEngaged(true);
          setOpen((value) => !value);
        }}
      >
        {open ? 'Close reporting' : 'Report a concern'}
      </button>
      <div id={id} hidden={!open}>
        {engaged && <ReportForm {...props} />}
      </div>
    </section>
  );
}
