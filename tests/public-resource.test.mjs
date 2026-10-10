import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { publicationFixture } from './fixtures/publication.mjs';
import { projectReleasedResource } from '../backend/publication/public-resource.ts';
import {
  parsePublicResource,
  resourcePath,
  resourceStructuredData,
  serializeStructuredData,
} from '../src/domain/public-resource.ts';
import {
  distributionPolicy,
  instructionText,
  resourcePackage,
  attributedInstructionText,
} from '../src/domain/distribution.ts';

async function releasedFixture() {
  const { specification, editorial } = await publicationFixture();
  return {
    agent_id: randomUUID(),
    slug: specification.identity.slug,
    version_id: randomUUID(),
    version: specification.version,
    specification,
    editorial,
    released_at: '2026-10-07T12:00:00Z',
    creator_name: 'AgentGrid Editorial',
    creator_username: null,
    creator_kind: 'first-party',
  };
}

test('released projection retains useful content without private evidence, review flags or Auth fields', async () => {
  const row = await releasedFixture();
  const resource = projectReleasedResource(row, []);
  assert.equal(resource.creator.name, 'AgentGrid Editorial');
  assert.deepEqual(resource.specification, row.specification);
  assert.equal('review' in resource.editorial, false);
  assert.equal('search_intent' in resource.editorial, false);
  assert.throws(() => projectReleasedResource({ ...row, auth_user_id: randomUUID() }, []));
  assert.throws(() => parsePublicResource({ ...resource, hostRuns: [] }));
  assert.throws(() => projectReleasedResource({ ...row, version: '9.9.9' }, []));
  assert.throws(() => projectReleasedResource({ ...row, slug: 'different-task' }, []));
  const unsupportedWorkflow = structuredClone(row);
  unsupportedWorkflow.specification.execution.artifact_path = 'artifacts/fixture.json';
  unsupportedWorkflow.specification.execution.artifact_sha256 = 'a'.repeat(64);
  assert.throws(() => projectReleasedResource(unsupportedWorkflow, []));
  row.specification.license.identifier = 'unselected';
  row.specification.license.permissions = {
    use: false,
    modify: false,
    redistribute: false,
    public_fork: false,
  };
  assert.throws(() => projectReleasedResource(row, []));
});

test('lineage preserves unavailable source attribution without exposing its content or private identity', async () => {
  const row = await releasedFixture();
  const lineage = {
    depth: 1,
    source_agent_id: randomUUID(),
    source_version_id: randomUUID(),
    source_slug: 'original-task',
    source_version: '1.0.0',
    creator_name: 'Deleted creator',
    source_available: false,
  };
  const resource = projectReleasedResource(row, [lineage]);
  assert.deepEqual(resource.lineage, [
    {
      source_slug: 'original-task',
      source_version: '1.0.0',
      creator_name: 'Deleted creator',
      source_available: false,
    },
  ]);
  assert.throws(() => projectReleasedResource(row, [{ ...lineage, depth: 2 }]));
  assert.throws(() =>
    projectReleasedResource(row, [{ ...lineage, private_email: 'private@example.com' }]),
  );
});

test('distribution respects publication and explicit rights instead of assuming community reuse', async () => {
  const { specification } = await publicationFixture();
  assert.equal(distributionPolicy(specification, false).canCopy, false);
  assert.throws(() => instructionText(specification, false));
  assert.equal(instructionText(specification, true), specification.execution.instructions);
  specification.license = {
    identifier: 'all-rights-reserved',
    statement: 'Synthetic fixture allows use only, without redistribution or public forks.',
    permissions: { use: true, modify: false, redistribute: false, public_fork: false },
  };
  assert.equal(distributionPolicy(specification, true).canCopy, true);
  assert.equal(distributionPolicy(specification, true).canExport, false);
  assert.equal(distributionPolicy(specification, true).canPublicFork, false);
  specification.license.permissions.use = false;
  assert.throws(() => instructionText(specification, true));
});

test('structured information is factual, canonical and safe inside an HTML script', async () => {
  const resource = projectReleasedResource(await releasedFixture(), []);
  resource.specification.identity.name = 'Example </script><script>alert(1)</script> agent';
  const data = resourceStructuredData(resource);
  const encoded = serializeStructuredData(data);
  assert.equal(encoded.includes('</script>'), false);
  assert.deepEqual(JSON.parse(encoded), data);
  assert.equal(data['@graph'][0]['@type'], 'CreativeWork');
  assert.equal(data['@graph'][0].url, 'https://agentgrid.me/agents/inbox-priority-triage/');
  assert.equal(data['@graph'][0].isAccessibleForFree, true);
  assert.equal(data['@graph'][0].citation[0].url, resource.editorial.sources[0].url);
  assert.equal(data['@graph'][0].isPartOf.url, 'https://agentgrid.me/categories/productivity/');
  assert.equal('dateTested' in data['@graph'][0], false);
  assert.equal('aggregateRating' in data['@graph'][0], false);
  assert.equal('interactionStatistic' in data['@graph'][0], false);
  assert.throws(() => resourcePath('../private'));
  assert.throws(() => resourcePath('task?auth=secret'));
});

test('downloaded definitions retain creator rights and lineage; selected hosts control copy mode', async () => {
  const resource = projectReleasedResource(await releasedFixture(), []);
  const bundle = resourcePackage(resource);
  assert.deepEqual(bundle.specification, resource.specification);
  assert.equal(bundle.attribution.creator, 'AgentGrid Editorial');
  assert.equal(bundle.attribution.source_url, 'https://agentgrid.me/agents/inbox-priority-triage/');
  const copied = attributedInstructionText(resource, 'chatgpt');
  assert.ok(copied.startsWith(resource.specification.execution.instructions + '\n'));
  assert.ok(copied.includes('Creator: AgentGrid Editorial'));
  assert.ok(copied.includes('License: MIT'));
  assert.ok(copied.includes(bundle.attribution.source_url));
  assert.equal(distributionPolicy(resource.specification, true, 'unknown-host').canCopy, false);
  assert.throws(() => instructionText(resource.specification, true, 'unknown-host'));
  resource.specification.license.permissions.redistribute = false;
  assert.throws(() => resourcePackage(resource));
});
