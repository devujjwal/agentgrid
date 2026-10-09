/** Empty free-tier production container only; no deployment, DNS, secrets or billing changes. */
import { resolve } from 'node:path';
import {
  productionAccount,
  productionProject,
  productionProjectPlan,
  inspectProductionProject,
} from './production-policy.mjs';

export async function configureProduction(token, apply, transport = fetch) {
  if (typeof token !== 'string' || token.length < 20 || /[\r\n]/.test(token))
    throw new Error('Approved personal Pages credential required.');
  const base = `https://api.cloudflare.com/client/v4/accounts/${productionAccount}/pages/projects`;
  const call = async (method, path, body) => {
    const response = await transport(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    if (method === 'GET' && response.status === 404) return null;
    if (!response.ok) throw new Error('Production provider operation unavailable.');
    const data = await response.json();
    if (!data.success) throw new Error('Production provider operation unsuccessful.');
    return data.result;
  };
  const existing = await call('GET', '/' + productionProject);
  if (existing) {
    inspectProductionProject(existing);
    return { project: productionProject, state: 'verified-existing', created: false };
  }
  if (!apply)
    return { project: productionProject, state: 'not-created', plan: productionProjectPlan() };
  // Never retry an uncertain mutation. A later invocation starts with a read.
  await call('POST', '', productionProjectPlan());
  inspectProductionProject(await call('GET', '/' + productionProject));
  return { project: productionProject, state: 'created-and-verified', created: true };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    if (
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.argv.length > 3 ||
      (process.argv.length === 3 && process.argv[2] !== '--create')
    )
      throw new Error('Explicit local setup only.');
    console.log(
      JSON.stringify(
        await configureProduction(process.env.CLOUDFLARE_API_TOKEN, process.argv[2] === '--create'),
      ),
    );
  } catch {
    console.error(
      'Production container was not verified. Inspect provider state before retrying; details withheld.',
    );
    process.exitCode = 1;
  }
}
