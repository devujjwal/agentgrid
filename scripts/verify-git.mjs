import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function verifyGit() {
  const root = git('rev-parse', '--show-toplevel');
  const baselinePath = resolve(
    root,
    git('rev-parse', '--git-path', 'agentgrid-global-baseline.json'),
  );
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const globalConfig = execFileSync('git', ['config', '--global', '--list', '--show-origin', '-z']);
  const digest = createHash('sha256').update(globalConfig).digest('hex');
  if (digest !== baseline.digest)
    throw new Error('Global Git configuration changed. Review before committing or pushing.');
  if (git('config', '--local', '--get', 'user.email') !== 'devujjwal1989@gmail.com') {
    throw new Error('AgentGrid requires the verified personal commit email.');
  }
  if (git('config', '--local', '--get', 'user.name') !== 'devujjwal') {
    throw new Error('AgentGrid requires the verified personal GitHub login as commit name.');
  }
  if (
    git('config', '--get', 'user.email') !== 'devujjwal1989@gmail.com' ||
    git('config', '--get', 'user.name') !== 'devujjwal'
  ) {
    throw new Error('Effective Git identity differs from the repository-local identity.');
  }
  for (const identity of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    if (!git('var', identity).startsWith('devujjwal <devujjwal1989@gmail.com> ')) {
      throw new Error('Commit author/committer override differs from the personal identity.');
    }
  }
  return root;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    verifyGit();
    console.log('Verified personal local identity; global Git configuration unchanged.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
