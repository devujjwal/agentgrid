import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicCatalogueChecksum } from '../src/domain/publication-snapshot.ts';
import { promotePublication } from '../scripts/promote-publication.mjs';
test('promotion rechecks current public source and preserves the reviewed capture provenance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-promote-'));
  try {
    const catalogue = { contract_version: '0.1', resources: [] };
    const hash = await publicCatalogueChecksum(catalogue);
    const delivery = {
      contract_version: '0.1',
      source_revision: 3,
      captured_at: '2026-10-08T00:00:00Z',
      catalogue_sha256: hash,
      resources: [],
    };
    const name = '3-' + hash.slice(0, 16);
    const source = join(root, '.agentgrid-publication-candidates', name),
      target = join(root, 'content/publication');
    await mkdir(source, { recursive: true });
    await mkdir(target, { recursive: true });
    for (const directory of [source, target]) {
      await writeFile(join(directory, 'catalogue.json'), JSON.stringify(catalogue));
      await writeFile(
        join(directory, 'delivery.json'),
        JSON.stringify({ ...delivery, source_revision: directory === source ? 3 : 0 }),
      );
    }
    let revision = 4,
      calls = 0;
    const rpc = async (name, body) => {
      assert.equal(name, 'agentgrid_publication_index');
      assert.deepEqual(body, { after_id: null });
      calls++;
      return { revision, items: [], hasMore: false };
    };
    await assert.rejects(promotePublication(name, hash, rpc, root), /no longer matches/);
    assert.equal(
      JSON.parse(await readFile(join(target, 'delivery.json'), 'utf8')).source_revision,
      0,
    );
    revision = 3;
    const promoted = await promotePublication(name, hash, rpc, root);
    assert.equal(calls, 4);
    assert.equal(promoted.captured_at, delivery.captured_at);
    assert.deepEqual(JSON.parse(await readFile(join(target, 'delivery.json'), 'utf8')), delivery);
    assert.equal(
      JSON.parse(await readFile(join(source, 'delivery.json'), 'utf8')).source_revision,
      3,
    );
    await assert.rejects(promotePublication('../' + name, hash, rpc, root), /Exact candidate/);
    await assert.rejects(promotePublication(name, 'f'.repeat(64), rpc, root), /Exact candidate/);
    await rm(join(source, 'delivery.json'));
    await symlink(join(target, 'delivery.json'), join(source, 'delivery.json'));
    await assert.rejects(promotePublication(name, hash, rpc, root), /Invalid publication input/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
