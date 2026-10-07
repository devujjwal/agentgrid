import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export function classifyAudit(report) {
  if (!report.metadata?.vulnerabilities || !report.advisories || report.error)
    throw new Error('Incomplete dependency audit; refusing to treat it as clean.');
  if (
    Object.values(report.metadata.vulnerabilities).some((count) => count > 0) &&
    !Object.keys(report.advisories).length
  )
    throw new Error('Audit counts have no advisory details; refusing an incomplete report.');
  const blocked = [];
  const exceptions = [];
  for (const advisory of Object.values(report.advisories)) {
    const scopedException =
      advisory.github_advisory_id === 'GHSA-vfj7-8cjw-p6xm' &&
      advisory.module_name === 'braces' &&
      advisory.severity === 'high' &&
      advisory.patched_versions === '<0.0.0' &&
      advisory.findings?.length > 0 &&
      advisory.findings.every(
        (finding) =>
          finding.version === '3.0.3' &&
          finding.paths?.length > 0 &&
          finding.paths.every(
            (path) => path === '.>@next/eslint-plugin-next>fast-glob>micromatch>braces',
          ),
      );
    (scopedException ? exceptions : blocked).push(
      advisory.github_advisory_id ?? 'unidentified-advisory',
    );
  }
  return { blocked, exceptions };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    let output;
    try {
      output = execFileSync('pnpm', ['audit', '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
    } catch (error) {
      if (!error.stdout) throw error;
      output = error.stdout;
    }
    const result = classifyAudit(JSON.parse(output));
    const manifest = JSON.parse(await readFile('package.json', 'utf8'));
    if (result.exceptions.length && manifest.dependencies?.['@next/eslint-plugin-next'])
      throw new Error('Lint-only exception cannot apply to a production dependency.');
    if (result.blocked.length)
      throw new Error('Unassessed dependency advisories block this build.');
    console.log(
      result.exceptions.length
        ? 'Full dependency audit passed with the documented, exact lint-only exception. See docs/OPERATIONS.md.'
        : 'Full dependency audit passed without advisories.',
    );
  } catch {
    console.error(
      'Dependency audit failed safely. Review advisories/connectivity; no raw subprocess output logged.',
    );
    process.exitCode = 1;
  }
}
