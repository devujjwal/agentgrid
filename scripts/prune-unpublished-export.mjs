/** Next 16 needs a nonempty dynamic-route export. Remove only its generated
 * reserved not-found path; it must never become a soft-404 on static hosting.
 * No content/source/user data is a target. Rebuilding reproduces these files.
 */
import { lstat, readFile, realpath, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('out');
for (const path of [
  'agents/__agentgrid_unpublished__',
  'qa/distribution',
  'qa/reviews',
  'qa/host-evidence',
  'qa/release-review',
  'qa/recovery',
]) {
  const reserved = resolve(root, path);
  try {
    const info = await lstat(reserved);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (await realpath(root)) !== root ||
      (await realpath(reserved)) !== reserved
    )
      throw new Error('Unexpected generated not-found path.');
    const html = await readFile(resolve(reserved, 'index.html'), 'utf8');
    if (!html.includes('noindex') || !html.includes('This page could not be found'))
      throw new Error('Reserved export is not the expected not-found document.');
    await rm(reserved, { recursive: true });
    console.log('Removed generated unpublished not-found path before static delivery.');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
