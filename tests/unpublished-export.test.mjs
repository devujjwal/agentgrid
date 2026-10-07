import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const prune = resolve('scripts/prune-unpublished-export.mjs');
test('empty-catalogue export removes only its generated reserved 404, preserving real resources', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-export-qa-'));
  try {
    const reserved = join(root, 'out/agents/__agentgrid_unpublished__');
    const qa = join(root, 'out/qa/distribution');
    const real = join(root, 'out/agents/real-resource');
    await mkdir(reserved, { recursive: true });
    await mkdir(real, { recursive: true });
    await mkdir(qa, { recursive: true });
    await writeFile(
      join(reserved, 'index.html'),
      '<meta name="robots" content="noindex">This page could not be found',
    );
    await writeFile(join(real, 'index.html'), 'real content');
    await writeFile(
      join(qa, 'index.html'),
      '<meta name="robots" content="noindex">This page could not be found',
    );
    execFileSync(process.execPath, [prune], { cwd: root });
    await assert.rejects(readFile(join(reserved, 'index.html')), { code: 'ENOENT' });
    await assert.rejects(readFile(join(qa, 'index.html')), { code: 'ENOENT' });
    assert.equal(await readFile(join(real, 'index.html'), 'utf8'), 'real content');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('export cleanup refuses a symlink to protected data and non-404 content', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-export-qa-'));
  try {
    const reserved = join(root, 'out/agents/__agentgrid_unpublished__');
    const protectedFixture = join(root, 'protected-fixture');
    await mkdir(join(root, 'out/agents'), { recursive: true });
    await mkdir(protectedFixture);
    await writeFile(join(protectedFixture, 'index.html'), 'protected fixture');
    await symlink(protectedFixture, reserved);
    assert.throws(() => execFileSync(process.execPath, [prune], { cwd: root, stdio: 'pipe' }));
    assert.equal(await readFile(join(protectedFixture, 'index.html'), 'utf8'), 'protected fixture');
    await rm(reserved);
    await mkdir(reserved);
    await writeFile(join(reserved, 'index.html'), 'not a generated not-found page');
    assert.throws(() => execFileSync(process.execPath, [prune], { cwd: root, stdio: 'pipe' }));
    assert.equal(
      await readFile(join(reserved, 'index.html'), 'utf8'),
      'not a generated not-found page',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
