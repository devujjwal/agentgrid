import { lstat, readdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { hardenDocument, verifyDocumentPolicy } from './static-csp.mjs';

export async function hardenStatic(root) {
  root = resolve(root);
  if (
    !['out', '.agentgrid-local-preview'].includes(basename(root)) ||
    (await lstat(root)).isSymbolicLink()
  )
    throw new Error('Only the generated static output may be hardened.');
  root = await realpath(root);
  const changes = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Symlink in static output.');
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.html')) {
        const hardened = hardenDocument(await readFile(path, 'utf8'));
        verifyDocumentPolicy(hardened);
        changes.push([path, hardened]);
      }
    }
  }
  await visit(root);
  if (!changes.length) throw new Error('No static HTML documents.');
  for (const [path, html] of changes) await writeFile(path, html);
  console.log(`Hardened ${changes.length} static documents with exact inline-block hashes.`);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  if (process.argv.length !== 2) throw new Error('No deployment-path overrides accepted.');
  await hardenStatic(resolve('out'));
}
