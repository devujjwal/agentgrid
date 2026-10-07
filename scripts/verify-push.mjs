import { execFileSync } from 'node:child_process';
import { verifyGit } from './verify-git.mjs';

const allowedRemote = 'https://devujjwal@github.com/devujjwal/agentgrid.git';
let stage = 'local identity';

try {
  verifyGit();
  stage = 'remote URL';
  const [remoteName = 'origin', suppliedUrl] = process.argv.slice(2);
  const remote =
    suppliedUrl ??
    execFileSync('git', ['remote', 'get-url', '--push', remoteName], { encoding: 'utf8' }).trim();
  if (remote !== allowedRemote)
    throw new Error('Push blocked: remote is not the approved personal repository.');
  stage = 'personal credential lookup';
  const token = execFileSync(
    'gh',
    ['auth', 'token', '--hostname', 'github.com', '--user', 'devujjwal'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  const env = { ...process.env, GH_TOKEN: token, GH_HOST: 'github.com' };
  const api = (path) =>
    JSON.parse(
      execFileSync('gh', ['api', path], {
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  stage = 'authenticated account';
  if (api('user').login !== 'devujjwal')
    throw new Error('Personal authentication did not resolve to devujjwal.');
  stage = 'repository ownership and visibility';
  const repository = api('repos/devujjwal/agentgrid');
  if (repository.owner.login !== 'devujjwal' || !repository.private) {
    throw new Error(
      'Repository owner or visibility differs from the approved private destination.',
    );
  }
  console.log(
    'Push verified: personal identity, unchanged global configuration, personal authentication, private destination.',
  );
} catch (error) {
  // Avoid printing subprocess buffers or environments, which may contain secrets.
  console.error(
    error instanceof Error && !('stderr' in error)
      ? error.message
      : `Push verification failed at ${stage}. Check connectivity/authentication (no credentials logged).`,
  );
  process.exitCode = 1;
}
