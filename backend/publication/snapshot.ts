/** Offline public-only capture. No staff evidence, Auth data or privileged client. */
import { z } from 'zod';
import {
  PublicationIndexSchema,
  DeliveryManifestSchema,
  parseCatalogue,
  assertDeliveryMatchesCatalogue,
  publicCatalogueChecksum,
  type DeliveryResource,
} from '../../src/domain/publication-snapshot.ts';
import { projectReleasedResource } from './public-resource.ts';
import type { PublicResource } from '../../src/domain/public-resource.ts';
export type PublicPublicationRpc = (
  name:
    | 'agentgrid_publication_index'
    | 'agentgrid_public_resource'
    | 'agentgrid_public_lineage'
    | 'agentgrid_public_delivery_state',
  body: Record<string, unknown>,
) => Promise<unknown>;
export class PublicationCaptureConflict extends Error {
  constructor() {
    super('Public content changed during capture. Discard the candidate and capture again.');
    this.name = 'PublicationCaptureConflict';
  }
}
async function readIndex(rpc: PublicPublicationRpc) {
  let cursor: string | null = null,
    revision: number | null = null;
  const items: DeliveryResource[] = [];
  for (let pageNumber = 0; pageNumber < 41; pageNumber++) {
    const page = PublicationIndexSchema.parse(
      await rpc('agentgrid_publication_index', { after_id: cursor }),
    );
    if (revision !== null && page.revision !== revision) throw new PublicationCaptureConflict();
    revision = page.revision;
    for (const item of page.items) {
      if (cursor !== null && item.resourceId <= cursor)
        throw new Error('Publication cursor did not advance.');
      cursor = item.resourceId;
      items.push(item);
    }
    if (items.length > 10000) throw new Error('Publication inventory exceeds capture bounds.');
    if (!page.hasMore) return { revision, items };
  }
  throw new Error('Publication pagination did not terminate.');
}
export async function capturePublicCatalogue(rpc: PublicPublicationRpc, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Valid capture clock required.');
  const before = await readIndex(rpc),
    resources: PublicResource[] = [];
  let bytes = 0;
  // Four in-flight resources bounds pressure on the shared free database.
  for (let start = 0; start < before.items.length; start += 4) {
    const batch = await Promise.all(
      before.items.slice(start, start + 4).map(async (item) => {
        const values = z
          .array(z.unknown())
          .max(1)
          .parse(await rpc('agentgrid_public_resource', { resource_slug: item.slug }));
        if (values.length !== 1) throw new PublicationCaptureConflict();
        const lineage = z
          .array(z.unknown())
          .max(32)
          .parse(await rpc('agentgrid_public_lineage', { resource_id: item.resourceId }));
        const resource = projectReleasedResource(values[0], lineage);
        if (
          resource.resource_id !== item.resourceId ||
          resource.version_id !== item.versionId ||
          resource.specification.identity.slug !== item.slug
        )
          throw new PublicationCaptureConflict();
        return resource;
      }),
    );
    for (const row of batch) {
      bytes += new TextEncoder().encode(JSON.stringify(row, null, 2)).byteLength;
      if (bytes > 30_000_000) throw new Error('Public capture exceeds its file budget.');
      resources.push(row);
    }
  }
  const after = await readIndex(rpc);
  if (
    before.revision !== after.revision ||
    JSON.stringify(before.items) !== JSON.stringify(after.items)
  )
    throw new PublicationCaptureConflict();
  const catalogue = parseCatalogue({ contract_version: '0.1', resources });
  if (new TextEncoder().encode(JSON.stringify(catalogue, null, 2)).byteLength > 32_000_000)
    throw new Error('Public catalogue exceeds build bounds.');
  const delivery = DeliveryManifestSchema.parse({
    contract_version: '0.1',
    source_revision: before.revision,
    captured_at: now.toISOString(),
    catalogue_sha256: await publicCatalogueChecksum(catalogue),
    resources: before.items,
  });
  assertDeliveryMatchesCatalogue(delivery, catalogue.resources);
  return { catalogue, delivery };
}
