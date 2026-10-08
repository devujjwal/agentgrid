import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationFixture } from './fixtures/publication.mjs';
import {
  capturePublicCatalogue,
  PublicationCaptureConflict,
} from '../backend/publication/snapshot.ts';
import {
  assertDeliveryMatchesCatalogue,
  publicCatalogueChecksum,
} from '../src/domain/publication-snapshot.ts';
async function fixture(count = 2) {
  const base = await publicationFixture();
  const rows = Array.from({ length: count }, (_, index) => ({
    agent_id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    version_id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    slug: `synthetic-capture-${index + 1}`,
    version: '1.0.0',
    specification: {
      ...base.specification,
      identity: { ...base.specification.identity, slug: `synthetic-capture-${index + 1}` },
    },
    editorial: base.editorial,
    released_at: '2026-10-08T00:00:00Z',
    creator_name: 'AgentGrid Editorial',
    creator_username: null,
    creator_kind: 'first-party',
  }));
  const items = rows.map((row) => ({
    resourceId: row.agent_id,
    versionId: row.version_id,
    slug: row.slug,
    tag: 'a'.repeat(64),
  }));
  const calls = [],
    state = { revision: 3, items, rows };
  const rpc = async (name, body) => {
    calls.push({ name, body });
    if (name === 'agentgrid_publication_index') {
      const remaining = state.items.filter(
        (item) => !body.after_id || item.resourceId > body.after_id,
      );
      return {
        revision: state.revision,
        items: remaining.slice(0, 250),
        hasMore: remaining.length > 250,
      };
    }
    if (name === 'agentgrid_public_resource')
      return state.rows.filter((row) => row.slug === body.resource_slug);
    if (name === 'agentgrid_public_lineage') return [];
    throw new Error('Unexpected private RPC');
  };
  return { rpc, state, calls };
}
test('capture exports only closed public projections with an exact delivery manifest and no private approval metadata', async () => {
  const { rpc, calls } = await fixture();
  const result = await capturePublicCatalogue(rpc, new Date('2026-10-08T01:00:00Z'));
  assert.equal(result.catalogue.resources.length, 2);
  assert.equal(result.delivery.catalogue_sha256, await publicCatalogueChecksum(result.catalogue));
  assert.equal(result.delivery.source_revision, 3);
  assert.equal(result.catalogue.resources[0].editorial.review, undefined);
  assert.equal(result.catalogue.resources[0].editorial.search_intent, undefined);
  assert.equal(calls.filter((call) => call.name === 'agentgrid_publication_index').length, 2);
  assertDeliveryMatchesCatalogue(result.delivery, result.catalogue.resources);
  assert.throws(() =>
    assertDeliveryMatchesCatalogue(
      { ...result.delivery, resources: [] },
      result.catalogue.resources,
    ),
  );
});
test('capture traverses bounded ordered pages and rechecks the entire index', async () => {
  const { rpc, calls } = await fixture(251);
  const result = await capturePublicCatalogue(rpc);
  assert.equal(result.catalogue.resources.length, 251);
  assert.equal(calls.filter((call) => call.name === 'agentgrid_publication_index').length, 4);
});
test('changes, disappearing releases, mismatched identities and private fields never produce a partial catalogue', async () => {
  for (const mode of ['revision', 'tag', 'disappear', 'identity', 'private-field']) {
    const { rpc, state } = await fixture();
    let changed = false;
    const source = async (name, body) => {
      if (name === 'agentgrid_public_resource' && !changed) {
        changed = true;
        if (mode === 'revision') state.revision++;
        if (mode === 'tag') state.items[0] = { ...state.items[0], tag: 'b'.repeat(64) };
        if (mode === 'disappear') return [];
        if (mode === 'identity')
          return [{ ...state.rows[0], version_id: state.rows[1].version_id }];
        if (mode === 'private-field')
          return [{ ...state.rows[0], reviewer_email: 'private@example.test' }];
      }
      return rpc(name, body);
    };
    await assert.rejects(
      capturePublicCatalogue(source),
      mode === 'private-field' ? undefined : PublicationCaptureConflict,
    );
  }
});
test('malformed cursors, duplicate paths and an invalid capture clock are rejected', async () => {
  const { rpc, state } = await fixture();
  await assert.rejects(capturePublicCatalogue(rpc, new Date('invalid')));
  state.items.reverse();
  await assert.rejects(capturePublicCatalogue(rpc), /cursor/);
  state.items.reverse();
  state.items[1] = { ...state.items[0], resourceId: state.items[1].resourceId };
  await assert.rejects(capturePublicCatalogue(rpc));
});
