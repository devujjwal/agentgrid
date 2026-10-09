/** Owner-approved staging bootstrap. Raw credentials live only in process memory. */
import { randomBytes } from 'node:crypto';
import { authConfiguration } from '../backend/auth/configuration.ts';
import { inspectStagingProject, stagingAccount, stagingProject } from './configure-staging.mjs';

export const stagingBackendName = 'agentgrid_staging_backend';
export const stagingBackendDescription =
  'AgentGrid staging Worker only; project-wide privilege; no PicMagic application operations. Revoke on extraction or retirement.';
const projectRef = 'lxecbrvzpmgjmsqiachc';
const supabaseBase = `https://api.supabase.com/v1/projects/${projectRef}/api-keys`;
const cloudflarePath = `https://api.cloudflare.com/client/v4/accounts/${stagingAccount}/pages/projects/${stagingProject}`;
const secretNames = [
  'SUPABASE_SECRET_KEY',
  'RESEND_API_KEY',
  'AGENTGRID_ENVELOPE_KEYS',
  'AGENTGRID_RATE_KEY',
  'AGENTGRID_PILOT_EMAILS',
];
const publicNames = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'RESEND_FROM_EMAIL',
];
const baseNames = ['AGENTGRID_STAGE', 'AGENTGRID_ORIGIN'];
const ownedKey = (keys) => {
  if (!Array.isArray(keys)) throw new Error('Unexpected provider inventory.');
  const matches = keys.filter((key) => key.name === stagingBackendName);
  if (
    matches.length > 1 ||
    (matches.length &&
      (matches[0].type !== 'secret' ||
        matches[0].description !== stagingBackendDescription ||
        JSON.stringify(matches[0].secret_jwt_template) !==
          JSON.stringify({ role: 'service_role' }) ||
        !/^[a-f0-9-]{36}$/.test(matches[0].id)))
  )
    throw new Error('Staging key collision; inspect before changing anything.');
  return matches[0];
};
const protectedKeys = (keys) =>
  JSON.stringify(
    keys
      .filter((key) => key.name !== stagingBackendName)
      .map(({ id, type, name, description, hash }) => ({ id, type, name, description, hash }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
function checkBindings(project, values) {
  inspectStagingProject(project);
  const live = project.deployment_configs.production.env_vars;
  const preview = project.deployment_configs.preview.env_vars;
  if (Object.keys(preview).some((name) => !baseNames.includes(name)))
    throw new Error('Branch previews must not receive staging credentials.');
  if (
    Object.keys(live).some((name) => ![...baseNames, ...secretNames, ...publicNames].includes(name))
  )
    throw new Error('Unexpected existing binding; no overwrite permitted.');
  for (const name of secretNames)
    if (live[name] && live[name].type !== 'secret_text')
      throw new Error('Existing server binding is not encrypted.');
  for (const name of publicNames)
    if (live[name] && (live[name].type !== 'plain_text' || live[name].value !== values[name]))
      throw new Error('Existing public configuration differs.');
  return [...secretNames, ...publicNames].filter((name) => !live[name]);
}

/** No filesystem, console, environment discovery, retries or credential return. */
export async function configureStagingSecrets(values, apply = false, transport = fetch) {
  const randomKey = () => randomBytes(32).toString('base64url');
  const candidate = {
    ...values,
    AGENTGRID_STAGE: 'preview',
    AGENTGRID_ORIGIN: 'https://agentgrid-staging.pages.dev',
    AGENTGRID_PILOT_EMAILS: 'devujjwal1989@gmail.com',
    SUPABASE_SECRET_KEY: 'sb_secret_' + 'x'.repeat(32),
    AGENTGRID_ENVELOPE_KEYS: JSON.stringify([{ id: 'staging-v1', material: randomKey() }]),
    AGENTGRID_RATE_KEY: randomKey(),
  };
  authConfiguration(candidate);
  if (
    values.CI ||
    values.GITHUB_ACTIONS ||
    values.NEXT_PUBLIC_SUPABASE_URL !== `https://${projectRef}.supabase.co` ||
    !/^sbp_(?:oauth_)?[a-f0-9]{40}$/.test(values.SUPABASE_ACCESS_TOKEN ?? '') ||
    !/^[A-Za-z0-9_-]{20,}$/.test(values.CLOUDFLARE_API_TOKEN ?? '')
  )
    throw new Error('Explicit personal staging setup configuration required.');
  const call = async (provider, method, suffix = '', body) => {
    if (
      (provider === 'cloudflare' && (suffix || !['GET', 'PATCH'].includes(method))) ||
      (provider === 'supabase' &&
        !(
          (method === 'GET' &&
            (suffix === '?reveal=false' || /^[a-f0-9/-]{37}\?reveal=true$/.test(suffix))) ||
          (method === 'POST' && suffix === '?reveal=true')
        ))
    )
      throw new Error('Unapproved provider operation.');
    try {
      const response = await transport(
        (provider === 'cloudflare' ? cloudflarePath : supabaseBase) + suffix,
        {
          method,
          headers: {
            Authorization:
              'Bearer ' +
              (provider === 'cloudflare'
                ? values.CLOUDFLARE_API_TOKEN
                : values.SUPABASE_ACCESS_TOKEN),
            'Content-Type': 'application/json',
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          redirect: 'error',
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (provider === 'cloudflare') {
        if (!result.success) throw new Error();
        return result.result;
      }
      return result;
    } catch {
      throw new Error(
        'Provider operation uncertain; inspect state before retrying. No diagnostics retained.',
      );
    }
  };
  const project = await call('cloudflare', 'GET');
  const missing = checkBindings(project, values);
  const keys = await call('supabase', 'GET', '?reveal=false');
  let key = ownedKey(keys);
  if (!missing.length) {
    if (!key) throw new Error('Encrypted bindings exist without the owned revocable key.');
    return { state: 'verified-existing', keyId: key.id, requiresLiveAcceptance: true };
  }
  if (!apply) return { state: 'prepared', missing, createKey: !key, previewSecrets: false };
  if (project.canonical_deployment || project.latest_deployment)
    throw new Error('Bootstrap is limited to an undeployed staging project.');
  if (!key) {
    const created = await call('supabase', 'POST', '?reveal=true', {
      type: 'secret',
      name: stagingBackendName,
      description: stagingBackendDescription,
      secret_jwt_template: { role: 'service_role' },
    });
    key = ownedKey([created]);
    if (!key) throw new Error('Created key identity unavailable; inspect existing state.');
  }
  if (missing.includes('SUPABASE_SECRET_KEY')) {
    if (!key.api_key?.startsWith('sb_secret_'))
      key = await call('supabase', 'GET', '/' + key.id + '?reveal=true');
    if (!ownedKey([key]) || !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key.api_key ?? ''))
      throw new Error('Owned staging credential unavailable.');
    candidate.SUPABASE_SECRET_KEY = key.api_key;
  }
  authConfiguration(candidate);
  const env_vars = Object.fromEntries(
    missing.map((name) => [
      name,
      { type: secretNames.includes(name) ? 'secret_text' : 'plain_text', value: candidate[name] },
    ]),
  );
  // Add only missing values. Never rotate/overwrite existing opaque credentials.
  await call('cloudflare', 'PATCH', '', { deployment_configs: { production: { env_vars } } });
  const verified = await call('cloudflare', 'GET');
  if (checkBindings(verified, values).length) throw new Error('Binding readback incomplete.');
  if (
    JSON.stringify(verified.deployment_configs.preview) !==
    JSON.stringify(project.deployment_configs.preview)
  )
    throw new Error('Preview environment changed unexpectedly.');
  const after = await call('supabase', 'GET', '?reveal=false');
  if (ownedKey(after)?.id !== key.id || protectedKeys(after) !== protectedKeys(keys))
    throw new Error('Provider key inventory changed unexpectedly.');
  return { state: 'configured-and-verified', keyId: key.id, requiresLiveAcceptance: true };
}
