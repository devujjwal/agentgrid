/** Read-only recovery verification after domain activation; never uploads or changes providers. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPublication } from './verify-publication.mjs';
import { assertCurrentCapture } from './promote-publication.mjs';
import { capturePublicCatalogue } from '../backend/publication/snapshot.ts';
import { publicPublicationSource } from '../backend/publication/source.ts';
import {
  assertProductionInventory,
  verifyProductionDelivery,
  productionOrigin,
  productionAlias,
} from './production-policy.mjs';
export async function verifyProduction(
  commit,
  root = resolve('.'),
  environment = process.env,
  transport = fetch,
) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Exact reviewed commit required.');
  const publication = await readPublication(resolve(root, 'content/publication'));
  assertProductionInventory(
    publication,
    JSON.parse(await readFile(resolve(root, 'content/launch/reviewed-editorial.json'), 'utf8')),
  );
  assertCurrentCapture(
    publication,
    await capturePublicCatalogue(
      publicPublicationSource(
        {
          origin: environment.NEXT_PUBLIC_SUPABASE_URL,
          key: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        },
        transport,
      ),
    ),
  );
  const proof = {
    contract_version: '0.1',
    commit,
    catalogue_sha256: publication.delivery.catalogue_sha256,
    source_revision: publication.delivery.source_revision,
  };
  await verifyProductionDelivery(proof, productionAlias, transport);
  await verifyProductionDelivery(proof, productionOrigin, transport);
  for (const resource of publication.catalogue.resources) {
    const response = await transport(
      productionOrigin + '/agents/' + resource.specification.identity.slug + '/',
      { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000) },
    );
    if (
      response.status !== 200 ||
      /noindex/.test(response.headers.get('x-robots-tag') ?? '') ||
      !(await response.text()).includes(resource.specification.identity.name)
    )
      throw new Error('Released catalogue delivery unavailable.');
  }
  return proof;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    if (process.argv.length !== 3) throw new Error('Exact commit required.');
    const proof = await verifyProduction(process.argv[2]);
    console.log(JSON.stringify({ state: 'canonical-delivery-verified', ...proof }));
  } catch {
    console.error(
      'Production delivery was not verified. No deployment or provider changes performed; details withheld.',
    );
    process.exitCode = 1;
  }
}
