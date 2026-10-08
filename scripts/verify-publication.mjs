/** Public-only build input gate. It never connects to a provider. */
import { readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  parseCatalogue,
  DeliveryManifestSchema,
  assertDeliveryMatchesCatalogue,
  publicCatalogueChecksum,
} from '../src/domain/publication-snapshot.ts';
export async function readPublication(directory) {
  const read = async (name, limit) => {
    const path = join(directory, name);
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > limit)
      throw new Error('Invalid publication input file.');
    return JSON.parse(await readFile(path, 'utf8'));
  };
  const catalogue = parseCatalogue(await read('catalogue.json', 32_000_000));
  const delivery = DeliveryManifestSchema.parse(await read('delivery.json', 3_000_000));
  assertDeliveryMatchesCatalogue(delivery, catalogue.resources);
  if ((await publicCatalogueChecksum(catalogue)) !== delivery.catalogue_sha256)
    throw new Error('Public catalogue digest does not match its delivery manifest.');
  return { catalogue, delivery };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const { catalogue } = await readPublication(resolve('content/publication'));
  console.log(`Verified publication inputs: ${catalogue.resources.length} public resources.`);
}
