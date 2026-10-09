import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { parseAgentSpecification } from '../src/domain/agent-specification.ts';
import { LAUNCH_CATEGORIES } from '../backend/publication/quality.ts';
import { firstPartyPackageLicense } from '../src/domain/legal.ts';

test('broad draft foundation stays portable, task-specific and unpublished', async () => {
  const agents = [];
  for (const slug of await readdir('content/agents')) {
    const directory = `content/agents/${slug}`;
    for (const file of await readdir(directory)) {
      if (!file.endsWith('.agent.json')) continue;
      const source = JSON.parse(await readFile(`${directory}/${file}`, 'utf8'));
      const agent = parseAgentSpecification(source);
      assert.equal(agent.identity.slug, slug);
      assert.equal(file, `${agent.version}.agent.json`);
      assert.deepEqual(agent.license, firstPartyPackageLicense);
      assert.equal(agent.execution.mode, 'interactive');
      assert.equal(agent.examples.length, 3);
      assert.match(agent.platforms[0].compatibility_notes, /draft|before this draft/);
      agents.push(agent);
    }
  }
  assert.deepEqual(new Set(agents.map((agent) => agent.category)), new Set(LAUNCH_CATEGORIES));
  // Coverage is an editorial draft gate, never a claim of publication or host verification.
  assert.ok(agents.length >= 36);
  for (const category of LAUNCH_CATEGORIES)
    assert.ok(agents.filter((agent) => agent.category === category).length >= 2, category);
  assert.equal(new Set(agents.map((agent) => agent.execution.instructions)).size, agents.length);
  assert.equal(new Set(agents.map((agent) => agent.examples[0].input)).size, agents.length);
});
