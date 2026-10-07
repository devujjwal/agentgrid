import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseAgentSpecification } from '../src/domain/agent-specification.ts';
import {
  canonicalJson,
  contentChecksum,
  preparePublication,
  PublicationQualityError,
  inspectLaunchInventory,
} from '../backend/publication/quality.ts';

const draft = JSON.parse(
  await readFile('content/agents/inbox-priority-triage/1.0.0.agent.json', 'utf8'),
);
const now = new Date('2026-10-07T10:00:00Z');

// Synthetic unit fixtures only. No real package, source check or host run is claimed.
async function fixture() {
  const specification = structuredClone(draft);
  specification.license = {
    identifier: 'MIT',
    statement: 'Synthetic unit fixture license; this does not release the real draft.',
    permissions: { use: true, modify: true, redistribute: true, public_fork: true },
  };
  const hash = await contentChecksum(parseAgentSpecification(specification));
  const editorial = {
    search_intent: 'Prioritize pasted, redacted email excerpts without granting mailbox access.',
    overview:
      'This synthetic editorial fixture explains who the workflow suits, what information a visitor supplies, and what decisions remain with the visitor. It distinguishes manual triage from scheduled mailbox access and gives context beyond a package description. It is not production editorial content.',
    audience: [
      'People who want to sort a small, selected message batch.',
      'Teams evaluating a manual inbox-priority workflow.',
    ],
    workflow: [
      'Select only the message excerpts needed for this triage decision and redact unrelated personal details.',
      'Supply a reference date so relative deadlines do not silently inherit an incorrect interpretation.',
      'Review suggested priorities and unanswered questions; perform all mailbox actions yourself.',
    ],
    faq: [
      {
        question: 'Does this fixture connect to a mailbox?',
        answer:
          'It models a manual workflow using pasted excerpts. There is no mailbox credential or connector and no background scheduling claim.',
      },
      {
        question: 'What happens when a deadline is unclear?',
        answer:
          'The expected behavior is to show the ambiguity and ask a focused clarification instead of inventing a due date or treating urgency as evidence.',
      },
      {
        question: 'Can a message instruct the model to send email?',
        answer:
          'The untrusted input policy treats messages as data. Suggested replies remain drafts, and a user must decide how to use them outside this workflow.',
      },
    ],
    sources: [
      {
        title: 'Synthetic source record for a unit test',
        url: 'https://example.com/source',
        supports: 'A placeholder in a synthetic test, not evidence supporting a real package.',
        checked_on: '2026-10-07',
      },
    ],
    related_agent_slugs: ['meeting-action-triage', 'weekly-planning'],
    reviewed_on: '2026-10-07',
    review: {
      standalone_value: true,
      task_specific_instructions: true,
      cost_disclosure: true,
      security_and_privacy: true,
      distribution_steps: true,
      reuse_rights: true,
    },
  };
  const hostRuns = ['normal', 'ambiguous-input', 'adversarial-input'].map((scenario) => ({
    origin: 'real-host',
    platform_slug: 'chatgpt',
    host_version: 'Synthetic unit fixture, not a real host',
    scenario,
    specification_sha256: hash,
    completed_on: '2026-10-07',
    input:
      'A synthetic unit test input used only to exercise validation of a recorded artifact. No model call was made.',
    observed_output:
      'A synthetic unit test output used only to exercise the quality contract. This is never treated as production host evidence.',
    assertions: [
      { description: 'Synthetic assertion A: does not perform a mailbox action.', passed: true },
      {
        description: 'Synthetic assertion B: retains explicit uncertainty in deadlines.',
        passed: true,
      },
    ],
    reviewer_notes:
      'Synthetic fixture for deterministic gate testing only. Actual host artifacts must be produced and reviewed before real publication.',
  }));
  return { specification, databaseContentDigest: 'a'.repeat(64), editorial, hostRuns };
}

test('prepared manifest binds exact portable content, private artifacts and database version digest', async () => {
  const input = await fixture();
  const prepared = await preparePublication(input, now);
  assert.equal(prepared.manifest.content_digest, input.databaseContentDigest);
  assert.equal(
    prepared.manifest.specification_sha256,
    await contentChecksum(prepared.specification),
  );
  assert.equal(prepared.manifest.host_run_sha256.length, 3);
  assert.equal(prepared.manifest.host_checks_passed, true);
  assert.equal('hostRuns' in prepared, false);
  assert.equal('observed_output' in prepared.manifest, false);
  assert.deepEqual(input.editorial, prepared.editorial);
});

test('missing, stale, future, illustrative, mismatched or failing evidence cannot publish', async () => {
  for (const mutation of [
    (input) => {
      input.hostRuns.pop();
    },
    (input) => {
      input.hostRuns[0].completed_on = '2025-01-01';
    },
    (input) => {
      input.hostRuns[0].completed_on = '2026-10-08';
    },
    (input) => {
      input.hostRuns[0].origin = 'illustrative';
    },
    (input) => {
      input.hostRuns[0].assertions[0].passed = false;
    },
    (input) => {
      input.specification.execution.instructions += '\nChanged after the recorded test.';
    },
    (input) => {
      input.editorial.sources[0].checked_on = '2026-10-08';
    },
    (input) => {
      input.editorial.review.security_and_privacy = false;
    },
    (input) => {
      input.hostRuns.push(structuredClone(input.hostRuns[0]));
    },
    (input) => {
      input.editorial.overview += ' Synthetic forbidden credential sb_secret_' + 'x'.repeat(32);
    },
  ]) {
    const input = await fixture();
    mutation(input);
    await assert.rejects(preparePublication(input, now));
  }
  const unlicensed = await fixture();
  unlicensed.specification.license = draft.license;
  await assert.rejects(preparePublication(unlicensed, now), PublicationQualityError);
});

test('every claimed platform needs all scenarios; related/FAQ context cannot be duplicated', async () => {
  const addedPlatform = await fixture();
  addedPlatform.specification.platforms.push({
    ...structuredClone(addedPlatform.specification.platforms[0]),
    slug: 'claude',
  });
  await assert.rejects(preparePublication(addedPlatform, now), (error) =>
    error.issues.some((issue) => issue.startsWith('claude:')),
  );
  const duplicated = await fixture();
  duplicated.editorial.related_agent_slugs = [draft.identity.slug, draft.identity.slug];
  duplicated.editorial.faq[1] = structuredClone(duplicated.editorial.faq[0]);
  await assert.rejects(preparePublication(duplicated, now), PublicationQualityError);
});

test('canonical hashes ignore object key order but reject lossy/non-JSON values', async () => {
  assert.equal(
    await contentChecksum({ b: [1, { d: 2, c: 3 }], a: 'x' }),
    await contentChecksum({ a: 'x', b: [1, { c: 3, d: 2 }] }),
  );
  for (const value of [
    { a: undefined },
    [NaN],
    [Infinity],
    [Number.MAX_SAFE_INTEGER + 1],
    new Array(1),
    new Date(),
    { a: 1n },
  ])
    assert.throws(() => canonicalJson(value));
});

test('launch gate requires broad quality coverage and rejects filler without an upper ceiling', async () => {
  const prepared = await preparePublication(await fixture(), now);
  const issues = inspectLaunchInventory([prepared]);
  assert.ok(issues.some((issue) => issue.includes('36')));
  assert.ok(issues.some((issue) => issue.startsWith('education:')));
  const categories = [
    'marketing',
    'productivity',
    'research',
    'education',
    'content',
    'ecommerce',
    'business-operations',
    'everyday',
    'seo',
    'development',
  ];
  // Synthetic inventory validation only; this does not create any launch packages.
  const resources = Array.from({ length: 110 }, (_, index) => ({
    specification: {
      ...structuredClone(prepared.specification),
      identity: { ...prepared.specification.identity, slug: `synthetic-${index}` },
      category: categories[index % categories.length],
      execution: {
        ...prepared.specification.execution,
        instructions: `Synthetic unique task ${index}`,
      },
    },
    editorial: {
      ...structuredClone(prepared.editorial),
      search_intent: `Synthetic distinct intent ${index}`,
      related_agent_slugs: [`synthetic-${(index + 1) % 110}`, `synthetic-${(index + 2) % 110}`],
    },
  }));
  assert.deepEqual(inspectLaunchInventory(resources), []);
  resources[1].specification.execution.instructions =
    resources[0].specification.execution.instructions;
  assert.ok(
    inspectLaunchInventory(resources).some((issue) => issue.includes('Duplicate instructions')),
  );
});

test('workflow publication requires the exact reviewed owned artifact bytes', async () => {
  const input = await fixture();
  const bytes = new TextEncoder().encode('{"steps":["synthetic workflow fixture"]}\n');
  const rawHash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');
  input.specification.execution.mode = 'scheduled-workflow';
  input.specification.execution.artifact_path = 'artifacts/synthetic-workflow.json';
  input.specification.execution.artifact_sha256 = rawHash;
  input.specification.platforms[0].distribution = 'workflow';
  const specHash = await contentChecksum(parseAgentSpecification(input.specification));
  input.hostRuns.forEach((run) => {
    run.specification_sha256 = specHash;
  });
  await assert.rejects(preparePublication(input, now), PublicationQualityError);
  input.artifactResolver = async (path) => {
    assert.equal(path, 'artifacts/synthetic-workflow.json');
    return bytes;
  };
  const prepared = await preparePublication(input, now);
  assert.equal(prepared.manifest.artifact_sha256, rawHash);
  input.artifactResolver = async () =>
    new TextEncoder().encode('{"steps":["changed after testing"]}');
  await assert.rejects(preparePublication(input, now), PublicationQualityError);
  input.artifactResolver = async () => new Uint8Array(100_001);
  await assert.rejects(preparePublication(input, now), PublicationQualityError);
});
