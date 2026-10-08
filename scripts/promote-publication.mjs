/** Explicitly promote a reviewed public candidate; never commit, release or deploy. */
import { lstat, realpath, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readPublication } from './verify-publication.mjs';
import { capturePublicCatalogue } from '../backend/publication/snapshot.ts';
import { publicPublicationSource } from '../backend/publication/source.ts';

export function assertCurrentCapture(candidate, current) {
  if (
    candidate.delivery.source_revision !== current.delivery.source_revision ||
    candidate.delivery.catalogue_sha256 !== current.delivery.catalogue_sha256 ||
    JSON.stringify(candidate.delivery.resources) !== JSON.stringify(current.delivery.resources)
  )
    throw new Error('Candidate no longer matches public source. Capture and review again.');
}
export async function promotePublication(candidateName, expectedHash, rpc, root = resolve('.')) {
  root = await realpath(root);
  if (
    !/^[0-9]+-[a-f0-9]{16}$/.test(candidateName) ||
    !/^[a-f0-9]{64}$/.test(expectedHash) ||
    !candidateName.endsWith('-' + expectedHash.slice(0, 16))
  )
    throw new Error('Exact candidate name and full reviewed digest required.');
  const candidateRoot = join(root, '.agentgrid-publication-candidates');
  const source = join(candidateRoot, candidateName);
  const target = join(root, 'content/publication');
  for (const directory of [candidateRoot, source, target])
    if (!(await lstat(directory)).isDirectory() || (await realpath(directory)) !== directory)
      throw new Error('Publication directory is not confined.');
  const candidate = await readPublication(source);
  if (
    candidate.delivery.catalogue_sha256 !== expectedHash ||
    candidate.delivery.source_revision.toString() !== candidateName.split('-')[0]
  )
    throw new Error('Candidate provenance does not match the reviewed identity.');
  await readPublication(target); // Refuse to overwrite an interrupted or malformed pair.
  assertCurrentCapture(candidate, await capturePublicCatalogue(rpc));
  const staging = randomUUID();
  const temporary = [];
  try {
    for (const name of ['catalogue', 'delivery']) {
      const path = join(target, '.' + name + '-' + staging + '.tmp');
      await writeFile(path, JSON.stringify(candidate[name], null, 2) + '\n', {
        flag: 'wx',
        mode: 0o644,
      });
      temporary.push(path);
    }
    // A crash between renames is fail-closed at the build gate. Retain the original
    // candidate; recover the exact pair deliberately, never accept a partial build.
    await rename(temporary[0], join(target, 'catalogue.json'));
    await rename(temporary[1], join(target, 'delivery.json'));
    await readPublication(target);
  } finally {
    for (const path of temporary)
      await unlink(path).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
  return candidate.delivery;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    if (process.env.CI || process.env.GITHUB_ACTIONS || process.argv.length !== 4)
      throw new Error('Local reviewed promotion required.');
    if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim())
      throw new Error('Commit or resolve existing changes before promotion.');
    execFileSync('node', ['scripts/verify-git.mjs'], { stdio: 'pipe' });
    const delivery = await promotePublication(
      process.argv[2],
      process.argv[3],
      publicPublicationSource({
        origin: process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      }),
    );
    console.log(
      `Promoted ${delivery.resources.length} reviewed public resources at revision ${delivery.source_revision}. Review the Git diff and run the quality gates; nothing was committed or deployed.`,
    );
  } catch {
    console.error(
      'Promotion refused or interrupted. Check clean Git state, exact candidate/digest and current public source. If replacement was interrupted, restore the exact pair from the retained candidate before building. Provider details withheld.',
    );
    process.exitCode = 1;
  }
}
