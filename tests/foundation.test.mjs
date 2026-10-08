import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateEnvironment } from '../scripts/verify-environment.mjs';
import { inspectExport } from '../scripts/verify-export.mjs';
import { hardenDocument } from '../scripts/static-csp.mjs';
const safeHtml = hardenDocument(
  '<!doctype html><html><head><meta charset="utf-8"></head><body>safe</body></html>',
);

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
};

test('production configuration rejects privileged or unapproved public variables', () => {
  assert.deepEqual(validateEnvironment(validEnvironment), []);
  assert.ok(
    validateEnvironment({ ...validEnvironment, NEXT_PUBLIC_RESEND_API_KEY: 'private' }).length,
  );
  assert.ok(
    validateEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private',
    }).length,
  );
  assert.ok(
    validateEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co.attacker.test',
    }).length,
  );
  assert.ok(
    validateEnvironment({
      ...validEnvironment,
      NEXT_PUBLIC_SUPABASE_URL: 'https://user:pass@project.supabase.co',
    }).length,
  );
  assert.ok(validateEnvironment({}).length);
});

test('export gate catches leaked credentials, source maps, and missing delivery files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-export-'));
  try {
    assert.equal((await inspectExport(root)).length, 4);
    for (const name of ['index.html', '404.html', 'robots.txt', '_headers'])
      await writeFile(join(root, name), name.endsWith('.html') ? safeHtml : 'safe');
    assert.deepEqual(await inspectExport(root), []);
    await writeFile(
      join(root, 'index.html'),
      '<div data-agentgrid-preview="local-only">Local design preview</div>',
    );
    assert.ok((await inspectExport(root)).some((error) => error.includes('Unpublished')));
    assert.ok(
      (await inspectExport(root, { localDesignPreview: true })).some((error) =>
        error.includes('exact private directory'),
      ),
    );
    await writeFile(join(root, 'index.html'), 'safe');
    await mkdir(join(root, 'qa/distribution'), { recursive: true });
    await writeFile(join(root, 'qa/distribution/index.html'), 'Synthetic fixture');
    assert.ok((await inspectExport(root)).some((error) => error.includes('Reserved')));
    await rm(join(root, 'qa'), { recursive: true });
    await writeFile(join(root, 'bundle.js'), 'data-agentgrid-qa-client');
    assert.ok(
      (await inspectExport(root)).some((error) => error.includes('Local acceptance component')),
    );
    await rm(join(root, 'bundle.js'));
    for (const value of [
      'sb_secret_' + 'x'.repeat(24),
      'sbp_oauth_' + '0'.repeat(40),
      'GOCSPX-' + 'x'.repeat(24),
      'cfat_' + 'x'.repeat(24),
    ]) {
      await writeFile(join(root, 'bundle.js'), value);
      assert.ok((await inspectExport(root)).some((error) => error.includes('credential')));
    }
    await writeFile(join(root, 'bundle.js.map'), '{}');
    const errors = await inspectExport(root);
    assert.ok(errors.some((error) => error.includes('credential')));
    assert.ok(errors.some((error) => error.includes('debug')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Git helper refuses credentials for any other repository or protocol', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-credential-'));
  try {
    await mkdir(join(root, 'bin'));
    await writeFile(join(root, 'bin', 'gh'), '#!/bin/sh\nprintf "unit-test-token"\n', {
      mode: 0o755,
    });
    const run = (input, action = 'get') =>
      spawnSync('sh', ['scripts/github-credential.sh', action], {
        input,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}` },
      });
    const valid = run('protocol=https\nhost=github.com\npath=devujjwal/agentgrid.git\n\n');
    assert.equal(valid.status, 0);
    assert.match(valid.stdout, /username=devujjwal/);
    for (const input of [
      'protocol=https\nhost=github.com\npath=work/repo.git\n\n',
      'protocol=http\nhost=github.com\npath=devujjwal/agentgrid.git\n\n',
      'protocol=https\nhost=github.com.attacker.test\npath=devujjwal/agentgrid.git\n\n',
    ]) {
      const result = run(input);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
    }
    assert.equal(run('', 'store').stdout, '');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('public export refuses encrypted-session key material and follows no symbolic links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-auth-export-'));
  const previous = process.env.AGENTGRID_ENVELOPE_KEYS;
  try {
    for (const name of ['index.html', '404.html', 'robots.txt', '_headers'])
      await writeFile(join(root, name), 'safe');
    const material = 'synthetic-local-key-material-for-export-only';
    process.env.AGENTGRID_ENVELOPE_KEYS = JSON.stringify([{ id: 'synthetic', material }]);
    await writeFile(join(root, 'bundle.js'), material);
    assert.ok((await inspectExport(root)).some((error) => error.includes('encryption material')));
    await writeFile(join(root, 'bundle.js'), 'safe');
    await symlink(join(root, 'index.html'), join(root, 'linked.js'));
    assert.ok((await inspectExport(root)).some((error) => error.includes('Symbolic link')));
  } finally {
    if (previous === undefined) delete process.env.AGENTGRID_ENVELOPE_KEYS;
    else process.env.AGENTGRID_ENVELOPE_KEYS = previous;
    await rm(root, { recursive: true, force: true });
  }
});
