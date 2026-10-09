import test from 'node:test';
import assert from 'node:assert/strict';
import { PackageLicenseSchema } from '../src/domain/agent-specification.ts';
import { firstPartyPackageLicense, legalOperator } from '../src/domain/legal.ts';
import {
  distributionPolicy,
  resourcePackage,
  attributedInstructionText,
} from '../src/domain/distribution.ts';
import { publicationFixture } from './fixtures/publication.mjs';
import { newDraft } from '../src/domain/draft.ts';

test('hosted first-party grants enable use and attributed on-site forks without package redistribution', async () => {
  const { specification } = await publicationFixture();
  specification.license = structuredClone(firstPartyPackageLicense);
  PackageLicenseSchema.parse(specification.license);
  assert.equal(distributionPolicy(specification, true).canCopy, true);
  assert.equal(distributionPolicy(specification, true).canPublicFork, true);
  assert.equal(distributionPolicy(specification, true).canExport, false);
  assert.equal(distributionPolicy(specification, false).canCopy, false);
  const resource = {
    specification,
    creator: { name: 'AgentGrid Editorial' },
    lineage: [
      { source_slug: 'source-agent', source_version: '1.0.0', creator_name: 'Original creator' },
    ],
  };
  assert.throws(() => resourcePackage(resource));
  const text = attributedInstructionText(resource, 'chatgpt');
  assert.ok(text.includes(specification.execution.instructions));
  assert.match(text, /Public fork scope: within AgentGrid only/);
  assert.match(text, /Original creator/);
  assert.match(text, /https:\/\/agentgrid.me\/licenses\/agentgrid-internal-use-v1\//);
});
test('scope exceptions reject contradictory grants and never become new community defaults', () => {
  for (const mutate of [
    (x) => {
      x.identifier = 'MIT';
    },
    (x) => {
      x.permissions.use = false;
    },
    (x) => {
      x.permissions.modify = false;
    },
    (x) => {
      x.permissions.redistribute = true;
    },
    (x) => {
      x.permissions.public_fork = false;
    },
    (x) => {
      x.public_fork_scope = 'everywhere';
    },
    (x) => {
      delete x.public_fork_scope;
    },
  ]) {
    const x = structuredClone(firstPartyPackageLicense);
    mutate(x);
    assert.equal(PackageLicenseSchema.safeParse(x).success, false);
  }
  assert.equal(legalOperator.capacity, 'individual');
  const draft = newDraft('New Agent', 'new-agent', 'productivity', 'chatgpt');
  assert.equal(draft.license.identifier, 'unselected');
  assert.equal(draft.license.public_fork_scope, undefined);
});
