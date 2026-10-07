import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAudit } from '../scripts/audit-dependencies.mjs';

const exception = {
  github_advisory_id: 'GHSA-vfj7-8cjw-p6xm',
  module_name: 'braces',
  severity: 'high',
  patched_versions: '<0.0.0',
  findings: [
    { version: '3.0.3', paths: ['.>@next/eslint-plugin-next>fast-glob>micromatch>braces'] },
  ],
};
const report = (advisories) => ({
  metadata: { vulnerabilities: { high: advisories.length } },
  advisories: Object.fromEntries(advisories.map((item, index) => [index, item])),
});

test('dependency gate permits only the assessed unpatched lint-only dependency path', () => {
  assert.deepEqual(classifyAudit(report([exception])), {
    blocked: [],
    exceptions: ['GHSA-vfj7-8cjw-p6xm'],
  });
  const broader = { ...exception, findings: [{ version: '3.0.3', paths: ['.>wrangler>braces'] }] };
  assert.equal(classifyAudit(report([broader])).blocked.length, 1);
  assert.equal(
    classifyAudit(report([{ ...exception, patched_versions: '>=3.0.4' }])).blocked.length,
    1,
  );
  assert.equal(classifyAudit(report([{ github_advisory_id: 'new-advisory' }])).blocked.length, 1);
});

test('failed or missing audit data never becomes a clean audit', () => {
  assert.throws(() => classifyAudit({}));
  assert.throws(() =>
    classifyAudit({ metadata: { vulnerabilities: { high: 1 } }, advisories: {} }),
  );
  assert.throws(() => classifyAudit({ ...report([]), error: { message: 'provider unavailable' } }));
  assert.deepEqual(classifyAudit(report([])), { blocked: [], exceptions: [] });
});
