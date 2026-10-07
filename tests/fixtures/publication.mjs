import { readFile } from 'node:fs/promises';
import { parseAgentSpecification } from '../../src/domain/agent-specification.ts';
import { contentChecksum } from '../../backend/publication/quality.ts';

export const draft = JSON.parse(
  await readFile('content/agents/inbox-priority-triage/1.0.0.agent.json', 'utf8'),
);
// Synthetic unit fixtures only. No real package, source check or host run is claimed.
export async function publicationFixture() {
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
    discovery: {
      keywords: ['email', 'triage', 'priority', 'summarize'],
      capability_tags: ['evidence-analysis', 'action-extraction'],
    },
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
