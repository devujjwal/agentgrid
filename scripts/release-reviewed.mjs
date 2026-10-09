/** Explicit local operator. Never discovers provider credentials or loads .env files. */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { z } from 'zod';
import { verifyGit } from './verify-git.mjs';
import { releaseOperatorClient } from '../backend/publication/operator-client.ts';
import {
  executeReviewedRelease,
  inspectReviewedRelease,
  prepareReviewedRelease,
  reviewedReleaseFingerprint,
} from '../backend/publication/release.ts';

export function releaseArguments(args, environment) {
  if (environment.CI || environment.GITHUB_ACTIONS) throw new Error('Local operator only.');
  const [action, requestId, fingerprint, commit] = args;
  if (
    !['inspect', 'prepare', 'publish'].includes(action) ||
    !z.uuid().safeParse(requestId).success ||
    args.length !== (action === 'publish' ? 4 : 2)
  )
    throw new Error('Explicit bounded release action required.');
  if (
    action === 'publish' &&
    (!/^[a-f0-9]{64}$/.test(fingerprint ?? '') || !/^[a-f0-9]{40}$/.test(commit ?? ''))
  )
    throw new Error('Exact preparation fingerprint and commit required.');
  return { action, requestId, fingerprint, commit };
}
const summary = (receipt) =>
  receipt === null
    ? { state: 'not-found' }
    : {
        requestId: receipt.requestId,
        resourceId: receipt.resourceId,
        versionId: receipt.versionId,
        state: receipt.state,
        expiresAt: receipt.expiresAt,
        decidedAt: receipt.decidedAt,
        selfReview: receipt.selfReview,
      };

export async function runReleaseAction(client, plan, now = new Date()) {
  z.uuid().parse(plan.requestId);
  if (plan.action === 'inspect')
    return {
      ...summary(await inspectReviewedRelease(client, plan.requestId)),
      meaning: 'Historical request outcome; not proof of current visibility or site deployment.',
    };
  if (plan.action === 'prepare') {
    const read = await client.rpc('agentgrid_prepare_release_request', {
      request_id: plan.requestId,
    });
    if (read.error) throw new Error('Preparation unavailable.');
    const prepared = await prepareReviewedRelease(read.data, now);
    if (prepared.approval.requestId !== plan.requestId) throw new Error('Request mismatch.');
    if (
      prepared.specification.execution.artifact_path ||
      prepared.specification.platforms.some((platform) => platform.distribution !== 'instructions')
    )
      throw new Error('Artifact delivery unavailable.');
    return {
      ...summary(prepared.approval),
      slug: prepared.specification.identity.slug,
      packageVersion: prepared.specification.version,
      reviewFingerprint: await reviewedReleaseFingerprint(prepared),
      meaning: 'Quality preparation passed. No publication write or deployment performed.',
    };
  }
  if (plan.action !== 'publish') throw new Error('Unknown action.');
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(plan.fingerprint);
  // No retry loop. A lost write acknowledgement must be resolved by inspect.
  const result = await executeReviewedRelease(
    client,
    plan.requestId,
    now,
    undefined,
    plan.fingerprint,
  );
  const confirmed = await inspectReviewedRelease(client, plan.requestId);
  if (
    !confirmed ||
    confirmed.state !== 'released' ||
    confirmed.versionId !== result.receipt.versionId ||
    confirmed.expectedDigest !== result.receipt.expectedDigest ||
    confirmed.decidedAt !== result.receipt.decidedAt
  )
    throw new Error('Release outcome uncertain.');
  return {
    ...summary(confirmed),
    reviewFingerprint: plan.fingerprint,
    meaning:
      'Database release confirmed. Capture, promotion and site deployment are separate steps.',
  };
}

function verifyReleaseCheckout(expectedCommit) {
  verifyGit();
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (
    git('branch', '--show-current') !== 'main' ||
    git('rev-parse', 'HEAD') !== expectedCommit ||
    git('status', '--porcelain')
  )
    throw new Error('Exact clean main required.');
  execFileSync(process.execPath, ['scripts/verify-push.mjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0] !== expectedCommit)
    throw new Error('Remote main differs.');
  const token = execFileSync(
    'gh',
    ['auth', 'token', '--hostname', 'github.com', '--user', 'devujjwal'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  const runs = JSON.parse(
    execFileSync(
      'gh',
      [
        'run',
        'list',
        '--repo',
        'devujjwal/agentgrid',
        '--workflow',
        'ci.yml',
        '--branch',
        'main',
        '--event',
        'push',
        '--commit',
        expectedCommit,
        '--json',
        'status,conclusion,headSha',
      ],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GH_TOKEN: token, GH_HOST: 'github.com' },
      },
    ),
  );
  if (
    !runs.some(
      (run) =>
        run.headSha === expectedCommit &&
        run.status === 'completed' &&
        run.conclusion === 'success',
    )
  )
    throw new Error('Exact main CI required.');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const plan = releaseArguments(process.argv.slice(2), process.env);
    if (plan.action === 'publish') verifyReleaseCheckout(plan.commit);
    const client = releaseOperatorClient(process.env, plan.action === 'publish');
    console.log(JSON.stringify(await runReleaseAction(client, plan), null, 2));
  } catch {
    console.error(
      'Release operation did not complete. Inspect the request outcome before any retry. Verify explicit configuration, current staff review, quality evidence and exact-main CI. No provider diagnostics, observations or credentials logged.',
    );
    process.exitCode = 1;
  }
}
