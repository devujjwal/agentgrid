/** Trusted preparation boundary; no provider keys or browser moderation authority. */
import { z } from 'zod';
import {
  assertJsonDocumentBounds,
  parseAgentSpecification,
  type AgentSpecification,
} from '../../src/domain/agent-specification.ts';
import { hasCredentialSignature } from '../security/public-content.ts';
import { EditorialSchema, type EditorialContent } from '../../src/domain/editorial.ts';
export type { EditorialContent } from '../../src/domain/editorial.ts';

import { HostRunSchema } from '../../src/domain/host-verification.ts';
export type { HostVerificationRun } from '../../src/domain/host-verification.ts';
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export { canonicalJson, contentChecksum } from '../../src/domain/content-checksum.ts';
import { contentChecksum } from '../../src/domain/content-checksum.ts';

export interface PublicationInput {
  /** Fetched by the server from the immutable version, never accepted as the browser's version. */
  specification: unknown;
  databaseContentDigest: string;
  /** Fetched with the specification from the same immutable database version. */
  editorial: unknown;
  hostRuns: unknown[];
  /** Resolves the owned private artifact, never fetches an arbitrary submission URL. */
  artifactResolver?: (path: string) => Promise<Uint8Array>;
}

export interface PublicationManifest {
  contract_version: '0.1';
  content_digest: string;
  specification_sha256: string;
  editorial_sha256: string;
  host_run_sha256: string[];
  artifact_sha256: string | null;
  reviewed_on: string;
  editorial_passed: true;
  host_checks_passed: true;
  security_review_passed: true;
}

export class PublicationQualityError extends Error {
  readonly issues: readonly string[];

  constructor(issues: string[]) {
    super('Resource does not pass the publication quality gate.');
    this.name = 'PublicationQualityError';
    this.issues = issues;
  }
}

/** Produces a compact private manifest bound to the exact immutable version and real artifacts. */
export async function preparePublication(input: PublicationInput, now = new Date()) {
  const spec = parseAgentSpecification(input.specification);
  const databaseDigest = digest.parse(input.databaseContentDigest);
  assertJsonDocumentBounds(input.editorial);
  const editorial = EditorialSchema.parse(input.editorial);
  // Bound before parsing/processing all runs. Never let an untrusted caller run
  // an unbounded moderation job just by supplying a large array.
  if (!Array.isArray(input.hostRuns) || input.hostRuns.length > 40)
    throw new PublicationQualityError(['At most 40 bounded host-test artifacts are accepted.']);
  const runs = input.hostRuns.map((run) => {
    assertJsonDocumentBounds(run);
    return HostRunSchema.parse(run);
  });
  const specificationDigest = await contentChecksum(spec);
  const issues: string[] = [];
  if (!editorial.discovery)
    issues.push('Reviewed task aliases and capability tags are required for discovery.');
  let artifactDigest: string | null = null;
  if (spec.execution.artifact_path) {
    if (!input.artifactResolver || !spec.execution.artifact_path.endsWith('.json')) {
      issues.push(
        'A bounded, owned JSON artifact must be available; ZIP distribution is not accepted yet.',
      );
    } else {
      try {
        const bytes = await input.artifactResolver(spec.execution.artifact_path);
        if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 100_000)
          throw new Error('Artifact exceeds limits.');
        const document: unknown = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        );
        assertJsonDocumentBounds(document);
        if (hasCredentialSignature(document)) throw new Error('Artifact requires redaction.');
        // Hash the actual downloadable bytes, including intentional whitespace.
        const hashed = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
        artifactDigest = Array.from(new Uint8Array(hashed), (value) =>
          value.toString(16).padStart(2, '0'),
        ).join('');
        if (artifactDigest !== spec.execution.artifact_sha256)
          throw new Error('Artifact no longer matches the tested specification.');
      } catch {
        issues.push(
          'The owned artifact is unavailable, unsafe, oversized or does not match its checksum.',
        );
      }
    }
  }
  if (
    hasCredentialSignature(spec) ||
    hasCredentialSignature(editorial) ||
    runs.some(hasCredentialSignature)
  )
    issues.push('Remove/redact potential credentials before retaining or publishing content.');
  const today = now.getTime();
  if (!Number.isFinite(today)) throw new Error('A valid publication clock is required.');
  const current = (value: string) => {
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return timestamp <= today && timestamp >= today - 90 * 24 * 60 * 60 * 1000;
  };
  if (spec.license.identifier === 'unselected' || !spec.license.permissions.use)
    issues.push('Choose explicit package reuse terms that permit using this resource.');
  if (
    !current(editorial.reviewed_on) ||
    editorial.sources.some((source) => !current(source.checked_on))
  )
    issues.push('Editorial and factual-source checks must be current, with no future dates.');
  if (
    new Set(editorial.related_agent_slugs).size !== editorial.related_agent_slugs.length ||
    editorial.related_agent_slugs.includes(spec.identity.slug)
  )
    issues.push('Related resources must be distinct and cannot point to this resource itself.');
  if (
    new Set(editorial.faq.map((item) => item.question.toLowerCase())).size !== editorial.faq.length
  )
    issues.push('FAQ questions must be distinct.');
  if (editorial.overview.toLowerCase() === spec.purpose.toLowerCase())
    issues.push('The editorial overview must add standalone context beyond the portable purpose.');
  const platforms = new Set(spec.platforms.map((platform) => platform.slug));
  for (const platform of platforms)
    for (const scenario of ['normal', 'ambiguous-input', 'adversarial-input'] as const)
      if (!runs.some((run) => run.platform_slug === platform && run.scenario === scenario))
        issues.push(`${platform}: a recorded ${scenario} host check is required.`);
  const keys = runs.map((run) => `${run.platform_slug}:${run.scenario}`);
  if (new Set(keys).size !== keys.length)
    issues.push(
      'Record one decisive current artifact per platform/scenario; retain older runs privately.',
    );
  for (const run of runs) {
    if (!platforms.has(run.platform_slug))
      issues.push('Host evidence references an undeclared platform.');
    if (run.specification_sha256 !== specificationDigest)
      issues.push('Host evidence does not match the exact specification content.');
    if (!current(run.completed_on))
      issues.push('Host checks must be current, with no future dates.');
    if (run.assertions.some((assertion) => !assertion.passed))
      issues.push('A failed host assertion must be resolved before publication.');
  }
  if (issues.length) throw new PublicationQualityError(issues);
  const manifest: PublicationManifest = {
    contract_version: '0.1',
    content_digest: databaseDigest,
    specification_sha256: specificationDigest,
    editorial_sha256: await contentChecksum(editorial),
    host_run_sha256: await Promise.all(runs.map(contentChecksum)),
    artifact_sha256: artifactDigest,
    reviewed_on: editorial.reviewed_on,
    editorial_passed: true,
    host_checks_passed: true,
    security_review_passed: true,
  };
  return { specification: spec, editorial, manifest };
}

export const LAUNCH_CATEGORIES = [
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
] as const;

/** Run only on prepared, approved resources; no target count can excuse duplicates. */
export function inspectLaunchInventory(
  resources: { specification: AgentSpecification; editorial: EditorialContent }[],
): string[] {
  const issues: string[] = [];

  if (resources.length < 36)
    issues.push('The launch foundation requires at least 36 prepared resources.');
  for (const category of LAUNCH_CATEGORIES)
    if (resources.filter((resource) => resource.specification.category === category).length < 3)
      issues.push(
        `${category}: meaningful launch coverage requires at least three useful resources.`,
      );
  const slugs = new Set(resources.map((resource) => resource.specification.identity.slug));
  if (
    resources.some((resource) =>
      resource.editorial.related_agent_slugs.some((slug) => !slugs.has(slug)),
    )
  )
    issues.push('Related resources must exist in the approved publication inventory.');
  for (const [label, values] of [
    ['slug', resources.map((resource) => resource.specification.identity.slug)],
    [
      'instructions',
      resources.map((resource) =>
        resource.specification.execution.instructions.trim().replace(/\s+/g, ' ').toLowerCase(),
      ),
    ],
    [
      'search intent',
      resources.map((resource) =>
        resource.editorial.search_intent.trim().replace(/\s+/g, ' ').toLowerCase(),
      ),
    ],
  ] as const)
    if (new Set(values).size !== values.length)
      issues.push(`Duplicate ${label} requires consolidation, not another page.`);
  return issues;
}
