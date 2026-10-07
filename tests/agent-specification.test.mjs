import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseAgentSpecification } from '../src/domain/agent-specification.ts';

const source = JSON.parse(
  await readFile('content/agents/inbox-priority-triage/1.0.0.agent.json', 'utf8'),
);
const draft = () => structuredClone(source);

test('draft resource is portable, interactive and explicitly unlicensed/unverified', () => {
  const agent = parseAgentSpecification(draft());
  assert.equal(agent.schema_version, '0.1');
  assert.equal(agent.execution.mode, 'interactive');
  assert.equal(agent.tools.length, 0);
  assert.equal(agent.license.identifier, 'unselected');
  assert.equal(agent.license.permissions.public_fork, false);
  assert.ok(agent.examples[0].assertions.length >= 2);
  assert.equal(JSON.stringify(source), JSON.stringify(agent));
});

test('portable payload cannot appoint its owner, claim moderation authority or silently change schema', () => {
  for (const fields of [
    { owner_id: 'another-user' },
    { status: 'published' },
    { reviews: [{ rating: 5 }] },
    { schema_version: '2.0' },
  ])
    assert.throws(() => parseAgentSpecification({ ...draft(), ...fields }));
  const unknown = draft();
  unknown.platforms[0].secret_key = 'must-not-be-a-portable-field';
  assert.throws(() => parseAgentSpecification(unknown));
});

test('automation/import claims need real artifacts and explicit write confirmation', () => {
  const scheduled = draft();
  scheduled.execution.mode = 'scheduled-workflow';
  assert.throws(() => parseAgentSpecification(scheduled));
  scheduled.execution.artifact_path = '../private.env';
  assert.throws(() => parseAgentSpecification(scheduled));
  const imported = draft();
  imported.platforms[0].distribution = 'workflow';
  assert.throws(() => parseAgentSpecification(imported));
  const write = draft();
  write.permissions[0].operation = 'write';
  assert.throws(() => parseAgentSpecification(write));
});

test('public fork grants require a selected license and consistent reuse permissions', () => {
  const unselected = draft();
  unselected.license.permissions.public_fork = true;
  assert.throws(() => parseAgentSpecification(unselected));
  const contradictory = draft();
  contradictory.license.identifier = 'MIT';
  assert.throws(() => parseAgentSpecification(contradictory));
  const custom = draft();
  custom.license.identifier = 'custom';
  custom.license.permissions = { use: true, modify: true, redistribute: false, public_fork: true };
  assert.throws(() => parseAgentSpecification(custom));
});

test('dangling tool requirements, duplicate identifiers and unsafe links cannot enter a specification', () => {
  const duplicate = draft();
  duplicate.inputs.push(structuredClone(duplicate.inputs[0]));
  assert.throws(() => parseAgentSpecification(duplicate));
  const dangling = draft();
  dangling.tools.push({
    id: 'email-connector',
    kind: 'integration',
    purpose: 'Read only the mailbox messages explicitly authorized for this workflow.',
    requirement_id: 'missing-account',
  });
  assert.throws(() => parseAgentSpecification(dangling));
  const unsafe = draft();
  unsafe.license.url = 'https://user:password@example.com/terms';
  assert.throws(() => parseAgentSpecification(unsafe));
});

test('untrusted extensions have bounded depth/size and cannot introduce prototype keys or cycles', () => {
  const unsafe = draft();
  unsafe.extensions = JSON.parse('{"x_future":{"__proto__":{"admin":true}}}');
  assert.throws(() => parseAgentSpecification(unsafe));
  const deep = draft();
  deep.extensions = { x_future: {} };
  let value = deep.extensions.x_future;
  for (let index = 0; index < 20; index++) {
    value.next = {};
    value = value.next;
  }
  assert.throws(() => parseAgentSpecification(deep));
  const cyclic = draft();
  cyclic.extensions = { x_future: cyclic };
  assert.throws(() => parseAgentSpecification(cyclic));
  const oversized = draft();
  oversized.extensions = { x_future: 'x'.repeat(100_001) };
  assert.throws(() => parseAgentSpecification(oversized));
  const exotic = draft();
  exotic.extensions = { x_future: new Date() };
  assert.throws(() => parseAgentSpecification(exotic));
});
