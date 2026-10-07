import { z } from 'zod';
import {
  AgentSpecificationSchema,
  PackageLicenseSchema,
  assertJsonDocumentBounds,
} from './agent-specification.ts';

// Drafts retain the portable shape and security envelope, but allow unfinished
// prose and empty sections. Public/submission validation remains the full spec.
const shape = AgentSpecificationSchema.shape;
const text = (maximum: number) => z.string().max(maximum);
const field = shape.inputs.element.extend({ label: text(100), description: text(600) });
export const DraftSpecificationSchema = z
  .strictObject({
    ...shape,
    identity: shape.identity.extend({ name: text(100).trim().min(4), summary: text(300) }),
    purpose: text(1800),
    capabilities: z
      .array(shape.capabilities.element.extend({ name: text(100), description: text(600) }))
      .max(12),
    execution: shape.execution.extend({ instructions: text(24000) }),
    inputs: z.array(field).max(12),
    outputs: z.array(field.omit({ required: true, contains_sensitive_data: true })).max(12),
    requirements: z.array(shape.requirements.element.extend({ description: text(600) })).max(16),
    platforms: z
      .array(
        shape.platforms.element.extend({
          slug: z.enum(['chatgpt', 'claude', 'gemini', 'codex', 'cursor', 'n8n']),
          setup_steps: z
            .array(
              shape.platforms.element.shape.setup_steps.element.extend({
                title: text(100),
                instructions: text(1800),
              }),
            )
            .max(10),
          compatibility_notes: text(1000),
        }),
      )
      .min(1)
      .max(6),
    tools: z.array(shape.tools.element.extend({ purpose: text(600) })).max(16),
    permissions: z
      .array(shape.permissions.element.extend({ resource: text(120), justification: text(600) }))
      .max(16),
    safety: shape.safety.extend({
      limitations: z.array(text(600)).max(12),
      privacy: text(1800),
      approval_policy: text(1800),
      untrusted_input_policy: text(1800),
      prohibited_actions: z.array(text(600)).max(12),
    }),
    examples: z
      .array(
        shape.examples.element.extend({
          title: text(100),
          input: text(8000),
          expected_output: text(12000),
          assertions: z.array(text(600)).max(12),
        }),
      )
      .max(5),
    pricing: shape.pricing.extend({ platform_costs: text(1200) }),
    license: PackageLicenseSchema,
  })
  .superRefine((draft, context) => {
    if (
      ![
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
      ].includes(draft.category)
    )
      context.addIssue({
        code: 'custom',
        path: ['category'],
        message: 'Choose an AgentGrid category.',
      });
    if (
      draft.identity.slug.length < 3 ||
      ['categories', 'new', 'search', 'submit'].includes(draft.identity.slug)
    )
      context.addIssue({
        code: 'custom',
        path: ['identity', 'slug'],
        message: 'Choose an available resource path.',
      });
    if (new Set(draft.platforms.map((item) => item.slug)).size !== draft.platforms.length)
      context.addIssue({
        code: 'custom',
        path: ['platforms'],
        message: 'Platforms must be unique.',
      });
    draft.permissions.forEach((permission, index) => {
      if (permission.operation === 'write' && !permission.confirmation_required)
        context.addIssue({
          code: 'custom',
          path: ['permissions', index, 'confirmation_required'],
          message: 'Write actions require explicit approval.',
        });
    });
  });
export type DraftSpecification = z.infer<typeof DraftSpecificationSchema>;
export function parseDraftSpecification(value: unknown): DraftSpecification {
  assertJsonDocumentBounds(value);
  return DraftSpecificationSchema.parse(value);
}
export const DraftRecordSchema = z.strictObject({
  resourceId: z.uuid(),
  status: z.enum(['active', 'blocked', 'archived']),
  revision: z.int().positive(),
  updatedAt: z.iso.datetime({ offset: true }),
  specification: DraftSpecificationSchema,
  // Kept intact during guided editing; trusted editorial review owns this later.
  editorial: z.record(z.string(), z.json()),
  sourceVersionId: z.uuid().nullable(),
});
export type DraftRecord = z.infer<typeof DraftRecordSchema>;
export const CreateDraftSchema = z.strictObject({ specification: DraftSpecificationSchema });
export const UpdateDraftSchema = z.strictObject({
  resourceId: z.uuid(),
  expectedRevision: z.int().positive(),
  specification: DraftSpecificationSchema,
});

export function newDraft(
  name: string,
  slug: string,
  category: string,
  platform: DraftSpecification['platforms'][number]['slug'],
): DraftSpecification {
  return parseDraftSpecification({
    schema_version: '0.1',
    identity: { name, slug, summary: '' },
    version: '0.1.0',
    category,
    purpose: '',
    capabilities: [],
    execution: { mode: 'interactive', autonomy: 'assistive', instructions: '' },
    inputs: [],
    outputs: [],
    requirements: [],
    platforms: [
      { slug: platform, distribution: 'instructions', setup_steps: [], compatibility_notes: '' },
    ],
    tools: [],
    permissions: [],
    safety: {
      limitations: [],
      privacy: '',
      approval_policy: '',
      untrusted_input_policy: '',
      prohibited_actions: [],
    },
    examples: [],
    pricing: { agentgrid_access: 'free', platform_costs: '' },
    license: {
      identifier: 'unselected',
      statement:
        'Reuse terms have not been selected. This private draft grants no reuse permissions.',
      permissions: { use: false, modify: false, redistribute: false, public_fork: false },
    },
  });
}
