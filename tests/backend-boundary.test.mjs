import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('public source cannot import privileged transport through ESM, dynamic import, or require', () => {
  for (const source of [
    "import '../backend/email/resend';",
    "void import('../backend/email/resend');",
    "require('../backend/email/resend');",
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        'node_modules/eslint/bin/eslint.js',
        '--stdin',
        '--stdin-filename',
        'src/security-boundary.ts',
        '--format',
        'json',
      ],
      { input: source, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    const messages = JSON.parse(result.stdout)[0].messages;
    assert.ok(
      messages.some((message) =>
        ['no-restricted-imports', 'no-restricted-modules', 'no-restricted-syntax'].includes(
          message.ruleId,
        ),
      ),
    );
  }
});
