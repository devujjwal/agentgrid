/** Checks delivered metadata and image bytes, not just the source configuration. */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'parse5';
export function socialImageReferences(html) {
  const references = [];
  const visit = (node) => {
    if (node.tagName === 'meta') {
      const attrs = Object.fromEntries(node.attrs.map((item) => [item.name, item.value]));
      if (attrs.property === 'og:image' || attrs.name === 'twitter:image')
        references.push(attrs.content);
    }
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(html));
  return references;
}
export function validateSocialImage(bytes) {
  if (
    bytes.length < 24 ||
    bytes.length > 300_000 ||
    bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
    bytes.toString('ascii', 12, 16) !== 'IHDR' ||
    bytes.readUInt32BE(16) !== 1200 ||
    bytes.readUInt32BE(20) !== 630
  )
    throw new Error('Invalid brand social image.');
}
export async function verifySocialExport(root) {
  const expected = 'https://agentgrid.me/social/agentgrid.png';
  validateSocialImage(await readFile(resolve(root, 'social/agentgrid.png')));
  let checked = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Unexpected symbolic link in social export.');
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.html')) {
        const references = socialImageReferences(await readFile(path, 'utf8'));
        if (references.length !== 2 || references.some((url) => url !== expected))
          throw new Error('Missing, duplicate or unexpected social image metadata: ' + path);
        checked++;
      }
    }
  }
  await visit(root);
  if (!checked) throw new Error('No social metadata documents found.');
  return checked;
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  console.log(
    `Verified social images in ${await verifySocialExport(resolve('out'))} exported documents.`,
  );
}
