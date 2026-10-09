import { z } from 'zod';

export const AGENT_SPECIFICATION_VERSION = '0.1' as const;
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const text = (minimum: number, maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine((value) => value.trim().length >= minimum, 'More detail is required.');
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Use an HTTPS URL without credentials.');

export const PackageLicenseSchema = z
  .strictObject({
    identifier: z.enum([
      'unselected',
      'CC-BY-4.0',
      'CC0-1.0',
      'MIT',
      'custom',
      'all-rights-reserved',
    ]),
    statement: text(24, 1600),
    url: httpsUrl.optional(),
    // Omission preserves the existing general redistribution/fork contract.
    // This explicit exception grants hosted forks without off-site distribution.
    public_fork_scope: z.literal('agentgrid-only').optional(),
    permissions: z.strictObject({
      use: z.boolean(),
      modify: z.boolean(),
      redistribute: z.boolean(),
      public_fork: z.boolean(),
    }),
  })
  .superRefine((license, context) => {
    const permissions = license.permissions;
    if (
      license.public_fork_scope &&
      (license.identifier !== 'custom' || !permissions.public_fork || permissions.redistribute)
    )
      context.addIssue({
        code: 'custom',
        path: ['public_fork_scope'],
        message:
          'AgentGrid-only forks require custom terms, a fork grant and no general redistribution grant.',
      });
    if (license.identifier === 'unselected' && Object.values(permissions).some(Boolean))
      context.addIssue({
        code: 'custom',
        path: ['permissions'],
        message: 'Unselected licenses cannot grant reuse permissions.',
      });
    if (
      license.identifier === 'all-rights-reserved' &&
      (permissions.redistribute || permissions.public_fork)
    )
      context.addIssue({
        code: 'custom',
        path: ['permissions'],
        message: 'Distribution/fork permissions require an explicit compatible license.',
      });
    if (
      permissions.public_fork &&
      !(
        permissions.use &&
        permissions.modify &&
        (permissions.redistribute || license.public_fork_scope === 'agentgrid-only')
      )
    )
      context.addIssue({
        code: 'custom',
        path: ['permissions', 'public_fork'],
        message:
          'Public forks require use, modification and either redistribution or explicit AgentGrid-only fork permission.',
      });
    if (
      ['CC-BY-4.0', 'CC0-1.0', 'MIT'].includes(license.identifier) &&
      !Object.values(permissions).every(Boolean)
    )
      context.addIssue({
        code: 'custom',
        path: ['permissions'],
        message: 'Standard open licenses cannot be paired with contradictory restrictions.',
      });
  });

const IOFieldSchema = z.strictObject({
  name: slug,
  label: text(3, 100),
  description: text(24, 600),
  format: z.enum(['text', 'csv', 'json', 'url', 'file']),
  required: z.boolean(),
  contains_sensitive_data: z.boolean(),
});

export const AgentSpecificationSchema = z
  .strictObject({
    schema_version: z.literal(AGENT_SPECIFICATION_VERSION),
    identity: z.strictObject({ slug, name: text(4, 100), summary: text(60, 300) }),
    version: z
      .string()
      .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
      .max(24),
    category: slug,
    purpose: text(120, 1800),
    capabilities: z
      .array(z.strictObject({ id: slug, name: text(4, 100), description: text(40, 600) }))
      .min(1)
      .max(12),
    execution: z.strictObject({
      mode: z.enum(['interactive', 'scheduled-workflow', 'event-workflow']),
      autonomy: z.enum(['assistive', 'review-before-action']),
      instructions: text(400, 24000),
      artifact_path: z
        .string()
        .regex(/^artifacts\/[a-z0-9-]+\.(json|zip)$/)
        .max(160)
        .optional(),
      artifact_sha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    }),
    inputs: z.array(IOFieldSchema).min(1).max(12),
    outputs: z
      .array(IOFieldSchema.omit({ required: true, contains_sensitive_data: true }))
      .min(1)
      .max(12),
    requirements: z
      .array(
        z.strictObject({
          id: slug,
          kind: z.enum(['input', 'integration', 'account', 'platform', 'runtime']),
          description: text(24, 600),
          required: z.boolean(),
        }),
      )
      .max(16),
    platforms: z
      .array(
        z.strictObject({
          slug,
          distribution: z.enum(['instructions', 'workflow', 'package']),
          setup_steps: z
            .array(z.strictObject({ title: text(4, 100), instructions: text(40, 1800) }))
            .min(2)
            .max(10),
          compatibility_notes: text(40, 1000),
        }),
      )
      .min(1)
      .max(10),
    tools: z
      .array(
        z.strictObject({
          id: slug,
          kind: z.enum(['mcp', 'integration', 'built-in']),
          purpose: text(40, 600),
          requirement_id: slug.optional(),
        }),
      )
      .max(16),
    permissions: z
      .array(
        z.strictObject({
          resource: text(4, 120),
          operation: z.enum(['read', 'write', 'network']),
          justification: text(40, 600),
          confirmation_required: z.boolean(),
        }),
      )
      .max(16),
    safety: z.strictObject({
      limitations: z.array(text(40, 600)).min(2).max(12),
      privacy: text(80, 1800),
      approval_policy: text(80, 1800),
      untrusted_input_policy: text(80, 1800),
      prohibited_actions: z.array(text(24, 600)).min(1).max(12),
    }),
    examples: z
      .array(
        z.strictObject({
          title: text(4, 100),
          input: text(80, 8000),
          expected_output: text(120, 12000),
          assertions: z.array(text(24, 600)).min(2).max(12),
        }),
      )
      .min(1)
      .max(5),
    pricing: z.strictObject({
      agentgrid_access: z.literal('free'),
      platform_costs: text(40, 1200),
    }),
    license: PackageLicenseSchema,
    extensions: z.record(z.string().regex(/^x_[a-z0-9_]{1,60}$/), z.json()).optional(),
  })
  .superRefine((agent, context) => {
    for (const key of [
      'capabilities',
      'inputs',
      'outputs',
      'requirements',
      'platforms',
      'tools',
    ] as const) {
      const ids = agent[key].map((item) =>
        'id' in item ? item.id : 'name' in item ? item.name : item.slug,
      );
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: 'custom',
          path: [key],
          message: 'Identifiers must be unique within each section.',
        });
    }
    const requirements = new Set(agent.requirements.map((item) => item.id));
    agent.tools.forEach((tool, index) => {
      if (tool.requirement_id && !requirements.has(tool.requirement_id))
        context.addIssue({
          code: 'custom',
          path: ['tools', index, 'requirement_id'],
          message: 'Tool requirement does not exist.',
        });
    });
    agent.permissions.forEach((permission, index) => {
      if (permission.operation === 'write' && !permission.confirmation_required)
        context.addIssue({
          code: 'custom',
          path: ['permissions', index, 'confirmation_required'],
          message: 'Write actions require explicit approval.',
        });
    });
    if (agent.execution.mode !== 'interactive' && !agent.execution.artifact_path)
      context.addIssue({
        code: 'custom',
        path: ['execution', 'artifact_path'],
        message: 'Automation requires an actual workflow/package artifact.',
      });
    if (Boolean(agent.execution.artifact_path) !== Boolean(agent.execution.artifact_sha256))
      context.addIssue({
        code: 'custom',
        path: ['execution', 'artifact_sha256'],
        message: 'Artifact paths and immutable file checksums must be supplied together.',
      });
    if (
      agent.platforms.some((platform) => platform.distribution !== 'instructions') &&
      !agent.execution.artifact_path
    )
      context.addIssue({
        code: 'custom',
        path: ['execution', 'artifact_path'],
        message: 'Importable packages require an actual artifact.',
      });
    if (new TextEncoder().encode(JSON.stringify(agent)).byteLength > 100_000)
      context.addIssue({
        code: 'custom',
        message: 'Specification exceeds the bounded document size.',
      });
  });

export type AgentSpecification = z.infer<typeof AgentSpecificationSchema>;

/** Host-specific identity, ownership, moderation and analytics never belong in the portable spec. */
export function assertJsonDocumentBounds(input: unknown): void {
  const pending: { value: unknown; depth: number }[] = [{ value: input, depth: 0 }];
  const seen = new WeakSet<object>();
  let count = 0;
  let characters = 0;
  while (pending.length) {
    const item = pending.pop();
    if (!item) break;
    if (++count > 5000 || item.depth > 16)
      throw new Error('Specification exceeds structural limits.');
    if (
      ['undefined', 'function', 'symbol', 'bigint'].includes(typeof item.value) ||
      (typeof item.value === 'number' &&
        (!Number.isFinite(item.value) ||
          (Number.isInteger(item.value) && !Number.isSafeInteger(item.value))))
    )
      throw new Error('JSON documents accept finite JSON values only.');
    if (typeof item.value === 'string') characters += item.value.length;
    if (item.value !== null && typeof item.value === 'object') {
      const prototype = Object.getPrototypeOf(item.value);
      if (!Array.isArray(item.value) && prototype !== Object.prototype && prototype !== null)
        throw new Error('Specification accepts plain JSON objects only.');
      if (seen.has(item.value)) throw new Error('Specification must be an acyclic JSON tree.');
      seen.add(item.value);
      for (const [key, value] of Object.entries(item.value)) {
        characters += key.length;
        if (['__proto__', 'prototype', 'constructor'].includes(key))
          throw new Error('Unsafe JSON property is not allowed.');
        pending.push({ value, depth: item.depth + 1 });
      }
    }
    if (characters > 100_000) throw new Error('Specification exceeds document limits.');
  }
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 100_000)
    throw new Error('JSON document exceeds byte limits.');
}

export function parseAgentSpecification(input: unknown): AgentSpecification {
  assertJsonDocumentBounds(input);
  return AgentSpecificationSchema.parse(input);
}
