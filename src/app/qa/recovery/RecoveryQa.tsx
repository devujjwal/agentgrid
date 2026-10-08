'use client';
import { useState } from 'react';
export function RecoveryQa() {
  const [fail, setFail] = useState(false);
  if (fail) throw new Error('Synthetic local rendering failure; no private data.');
  return (
    <main id="main-content" data-agentgrid-qa-client="recovery">
      <h1>Local recovery acceptance</h1>
      <p>
        This disposable page throws only after the test button is activated. It cannot submit or
        modify data.
      </p>
      <button type="button" onClick={() => setFail(true)}>
        Trigger rendering failure
      </button>
    </main>
  );
}
