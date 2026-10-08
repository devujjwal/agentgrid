/** Create only AgentGrid's empty, free-tier Pages staging container. No secrets/deployments. */
import { resolve } from 'node:path';
export const stagingAccount = 'b26860f18457e76742260d8bb979134f';
export const stagingProject = 'agentgrid-staging';
export function stagingProjectPlan() {
  const configuration = {
    compatibility_date: '2026-10-07',
    compatibility_flags: [],
    fail_open: false,
    env_vars: {
      AGENTGRID_STAGE: { type: 'plain_text', value: 'preview' },
      AGENTGRID_ORIGIN: { type: 'plain_text', value: 'https://agentgrid-staging.pages.dev' },
    },
  };
  return {
    name: stagingProject,
    production_branch: 'main',
    deployment_configs: {
      production: structuredClone(configuration),
      preview: structuredClone(configuration),
    },
  };
}
export function inspectStagingProject(project) {
  if (
    project.name !== stagingProject ||
    project.production_branch !== 'main' ||
    project.source ||
    project.domains?.some((domain) => domain !== 'agentgrid-staging.pages.dev')
  )
    throw new Error('Unexpected staging ownership, source or domains.');
  for (const stage of ['production', 'preview']) {
    const config = project.deployment_configs?.[stage];
    if (
      !config ||
      config.fail_open !== false ||
      config.compatibility_date !== '2026-10-07' ||
      (config.compatibility_flags ?? []).length ||
      config.env_vars?.AGENTGRID_STAGE?.value !== 'preview' ||
      config.env_vars?.AGENTGRID_ORIGIN?.value !== 'https://agentgrid-staging.pages.dev'
    )
      throw new Error('Staging delivery policy does not match the approved design.');
    for (const name of [
      'kv_namespaces',
      'd1_databases',
      'r2_buckets',
      'durable_object_namespaces',
      'services',
      'analytics_engine_datasets',
      'ai_bindings',
      'hyperdrive_bindings',
      'browsers',
    ])
      if (Object.keys(config[name] ?? {}).length)
        throw new Error('Unexpected additional service binding.');
  }
  return true;
}
export async function configureStaging(token, apply, transport = fetch) {
  if (typeof token !== 'string' || token.length < 20 || /[\r\n]/.test(token))
    throw new Error('Approved credential required.');
  const base = `https://api.cloudflare.com/client/v4/accounts/${stagingAccount}/pages/projects`;
  const call = async (method, path, body) => {
    const response = await transport(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    if (method === 'GET' && response.status === 404) return null;
    if (!response.ok)
      throw new Error('Cloudflare operation unavailable; inspect state before retrying.');
    const data = await response.json();
    if (!data.success) throw new Error('Cloudflare operation did not succeed.');
    return data.result;
  };
  const existing = await call('GET', '/' + stagingProject);
  if (existing) {
    inspectStagingProject(existing);
    return { state: 'verified-existing', created: false };
  }
  if (!apply) return { state: 'not-created', plan: stagingProjectPlan() };
  // On any uncertain POST result stop. The next invocation begins with a GET;
  // it never blindly repeats creation or overwrites an existing project.
  await call('POST', '', stagingProjectPlan());
  inspectStagingProject(await call('GET', '/' + stagingProject));
  return { state: 'created-and-verified', created: true };
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    if (
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.argv.length > 3 ||
      (process.argv.length === 3 && process.argv[2] !== '--create')
    )
      throw new Error('Local explicit staging setup only.');
    const result = await configureStaging(
      process.env.CLOUDFLARE_API_TOKEN,
      process.argv[2] === '--create',
    );
    console.log(JSON.stringify(result));
    console.log('No application secrets, content, deployment, domain or billing settings changed.');
  } catch {
    console.error(
      'Staging setup did not complete; inspect the personal project configuration before retrying. Provider details withheld.',
    );
    process.exitCode = 1;
  }
}
