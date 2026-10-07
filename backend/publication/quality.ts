/** Trusted preparation boundary; no provider keys or browser moderation authority. */
import { z } from 'zod';
import {
  assertJsonDocumentBounds,
  parseAgentSpecification,
  type AgentSpecification,
} from '../../src/domain/agent-specification.ts';
import { hasCredentialSignature } from '../security/public-content.ts';

const detail = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const date = z.iso.date();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});

const EditorialSchema = z.strictObject({
  search_intent: detail(40, 300),
  overview: detail(240, 4000),
  audience: z.array(detail(24, 240)).min(2).max(8),
  workflow: z.array(detail(60, 1000)).min(3).max(10),
  faq: z
    .array(z.strictObject({ question: detail(12, 180), answer: detail(80, 1600) }))
    .min(3)
    .max(10),
  sources: z
    .array(
      z.strictObject({
        title: detail(8, 160),
        url: httpsUrl,
        supports: detail(40, 600),
        checked_on: date,
      }),
    )
    .min(1)
    .max(12),
  related_agent_slugs: z
    .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
    .min(2)
    .max(8),
  reviewed_on: date,
  review: z.strictObject({
    standalone_value: z.literal(true),
    task_specific_instructions: z.literal(true),
    cost_disclosure: z.literal(true),
    security_and_privacy: z.literal(true),
    distribution_steps: z.literal(true),
    reuse_rights: z.literal(true),
  }),
});

/** The private redacted artifact must contain observed output, not an illustrative sample. */
const HostRunSchema = z.strictObject({
  origin: z.literal('real-host'),
  platform_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  host_version: detail(3, 160),
  scenario: z.enum(['normal', 'ambiguous-input', 'adversarial-input']),
  specification_sha256: digest,
  completed_on: date,
  input: detail(80, 8000),
  observed_output: detail(80, 16000),
  assertions: z
    .array(z.strictObject({ description: detail(24, 600), passed: z.boolean() }))
    .min(2)
    .max(12),
  reviewer_notes: detail(80, 1600),
});
export type EditorialContent = z.infer<typeof EditorialSchema>;
export type HostVerificationRun = z.infer<typeof HostRunSchema>;

/** AgentGrid canonical-json-v1: sorted UTF-16 keys, JSON.stringify primitives, no whitespace. */
export function canonicalJson(value: unknown): string {
  assertJsonDocumentBounds(value);
  function encode(item: unknown): string {
    if (Array.isArray(item)) return `[${Array.from(item, encode).join(',')}]`;
    if (item !== null && typeof item === 'object')
      return `{${Object.keys(item)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode((item as Record<string, unknown>)[key])}`)
        .join(',')}}`;
    const encoded = JSON.stringify(item);
    if (encoded === undefined || (typeof item === 'number' && !Number.isFinite(item)))
      throw new Error('Canonical document must contain finite JSON values only.');
    return encoded;
  }
  return encode(value);
}

export async function contentChecksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hashed = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashed), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}

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
