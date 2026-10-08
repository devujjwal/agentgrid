import { z } from 'zod';
import { parsePublicResource, type PublicResource } from './public-resource.ts';
export const DeliveryResourceSchema = z.strictObject({
  resourceId: z.uuid(),
  versionId: z.uuid(),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  tag: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DeliveryResource = z.infer<typeof DeliveryResourceSchema>;
export const PublicationIndexSchema = z
  .strictObject({
    revision: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
    items: z.array(DeliveryResourceSchema).max(250),
    hasMore: z.boolean(),
  })
  .refine((page) => !page.hasMore || page.items.length === 250);
export const DeliveryManifestSchema = z
  .strictObject({
    contract_version: z.literal('0.1'),
    source_revision: z.int().min(0).max(Number.MAX_SAFE_INTEGER),
    captured_at: z.iso.datetime({ offset: true }),
    catalogue_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    resources: z.array(DeliveryResourceSchema).max(10000),
  })
  .refine((value) =>
    ['resourceId', 'versionId', 'slug'].every(
      (key) =>
        new Set(value.resources.map((row) => row[key as keyof DeliveryResource])).size ===
        value.resources.length,
    ),
  );
export type DeliveryManifest = z.infer<typeof DeliveryManifestSchema>;
const CatalogueEnvelope = z.strictObject({
  contract_version: z.literal('0.1'),
  resources: z.array(z.unknown()).max(10000),
});
export function parseCatalogue(value: unknown): {
  contract_version: '0.1';
  resources: PublicResource[];
} {
  const parsed = CatalogueEnvelope.parse(value),
    resources = parsed.resources.map(parsePublicResource);
  for (const key of ['resource_id', 'version_id'] as const)
    if (new Set(resources.map((row) => row[key])).size !== resources.length)
      throw new Error('Duplicate public resource identity.');
  if (new Set(resources.map((row) => row.specification.identity.slug)).size !== resources.length)
    throw new Error('Duplicate public resource path.');
  return { contract_version: '0.1', resources };
}
export function assertDeliveryMatchesCatalogue(
  manifest: DeliveryManifest,
  resources: PublicResource[],
) {
  if (manifest.resources.length !== resources.length)
    throw new Error('Publication and delivery inventories differ.');
  const byId = new Map(resources.map((row) => [row.resource_id, row]));
  for (const item of manifest.resources) {
    const resource = byId.get(item.resourceId);
    if (
      !resource ||
      resource.version_id !== item.versionId ||
      resource.specification.identity.slug !== item.slug
    )
      throw new Error('Delivery identity does not match the public catalogue.');
  }
}

/** Hash the closed, schema-ordered JSON representation, independent of file whitespace. */
export async function publicCatalogueChecksum(value: unknown) {
  const catalogue = parseCatalogue(value);
  const bytes = new TextEncoder().encode(JSON.stringify(catalogue));
  if (bytes.byteLength > 32_000_000) throw new Error('Public catalogue exceeds build bounds.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
