'use client';
import { useState } from 'react';
import { HostEvidenceForm } from '../../../components/moderation/HostEvidenceForm';
import type { HostVerificationRun } from '../../../domain/host-verification';
export function HostEvidenceQa() {
  const [value, setValue] = useState<HostVerificationRun>({
    origin: 'real-host',
    platform_slug: 'chatgpt',
    host_version: '',
    scenario: 'normal',
    specification_sha256: '0'.repeat(64),
    completed_on: '',
    input: '',
    observed_output: '',
    assertions: [
      { description: '', passed: false },
      { description: '', passed: false },
    ],
    reviewer_notes: '',
  });
  const [attested, setAttested] = useState(false),
    [message, setMessage] = useState('');
  return (
    <>
      {message && <p role="status">{message}</p>}
      <HostEvidenceForm
        value={value}
        platforms={['chatgpt']}
        change={(next) => {
          setValue(next);
          setAttested(false);
        }}
        disabled={false}
        attested={attested}
        setAttested={setAttested}
        record={() =>
          setMessage('Local presentation fixture only. Nothing was recorded or approved.')
        }
      />
    </>
  );
}
