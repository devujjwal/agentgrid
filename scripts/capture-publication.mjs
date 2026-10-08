/** Read public projections into a local review candidate. Never publishes or reads setup secrets. */
import { mkdir, lstat, realpath, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { publicPublicationSource } from '../backend/publication/source.ts';
import { capturePublicCatalogue } from '../backend/publication/snapshot.ts';

try {
  if (process.argv.length !== 2 || process.env.CI || process.env.GITHUB_ACTIONS)
    throw new Error('Explicit local public capture required.');
  const rpc = publicPublicationSource({
    origin: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  const { catalogue, delivery } = await capturePublicCatalogue(rpc);
  const root = resolve('.agentgrid-publication-candidates');
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink() || (await realpath(root)) !== root)
    throw new Error('Candidate directory is not confined.');
  const candidate = join(
    root,
    `${delivery.source_revision}-${delivery.catalogue_sha256.slice(0, 16)}`,
  );
  // Refuse to replace earlier candidates, including an interrupted capture.
  await mkdir(candidate, { mode: 0o700 });
  await writeFile(join(candidate, 'catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  await writeFile(join(candidate, 'delivery.json'), JSON.stringify(delivery, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    `Captured ${catalogue.resources.length} public resources at revision ${delivery.source_revision}. Candidate: ${candidate}`,
  );
  console.log(
    'No active catalogue, database content or deployment was changed. Review completeness before promoting this candidate.',
  );
} catch {
  console.error(
    'Public capture did not complete. Check public configuration, source availability and candidate state. Provider details are withheld; do not replace an existing candidate blindly.',
  );
  process.exitCode = 1;
}
