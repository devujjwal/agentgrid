import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { readRecipePublication } from './verify-recipe-publication.mjs';
import { verifyDocumentPolicy } from './static-csp.mjs';

export async function inspectExport(root, { localDesignPreview = false } = {}) {
  const errors = [];
  if (
    localDesignPreview &&
    (basename(root) !== '.agentgrid-local-preview' || process.env.CI || process.env.GITHUB_ACTIONS)
  ) {
    errors.push('Local design exception requires its exact private directory outside CI.');
  }
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink())
        errors.push(`Symbolic link in public export: ${relative(root, path)}`);
      else if (entry.isDirectory()) await visit(path);
      else files.push(path);
    }
  }
  await visit(root);
  const required = ['index.html', '404.html', 'robots.txt', '_headers'];
  const names = new Set(files.map((file) => relative(root, file)));
  for (const name of required) {
    if (!names.has(name)) errors.push(`Missing static delivery artifact: ${name}`);
  }
  const recipeSlugs = localDesignPreview
    ? null
    : new Set((await readRecipePublication()).map(({ recipe }) => recipe.slug));
  for (const path of files) {
    const name = relative(root, path);
    if (recipeSlugs && name.startsWith('recipes/')) {
      const segment = name.slice('recipes/'.length).split('/')[0];
      const listing =
        ['index.html', 'index.txt'].includes(segment) || segment.startsWith('__next.');
      if (!listing && !recipeSlugs.has(segment.replace(/\.(?:html|txt)$/, '')))
        errors.push(`Unpublished or stale recipe artifact: ${name}`);
    }
    if (
      name.includes('__agentgrid_unpublished__') ||
      (!localDesignPreview && name.startsWith('qa/'))
    )
      errors.push(`Reserved not-found path in public export: ${name}`);
    if (/(^|\/)\.env(?:\.|$)|\.map$|(^|\/)(backups|\.git)\//.test(name)) {
      errors.push(`Private/debug artifact in public export: ${name}`);
    }
    if (!/\.(html|js|json|txt|css|svg)$/.test(name)) continue;
    const content = await readFile(path, 'utf8');
    if (name.endsWith('.html')) {
      try {
        verifyDocumentPolicy(content);
      } catch {
        errors.push(`Missing or mismatched static CSP: ${name}`);
      }
    }
    if (!localDesignPreview && content.includes('data-agentgrid-qa-client'))
      errors.push(`Local acceptance component in public artifact: ${name}`);
    if (
      !localDesignPreview &&
      name.endsWith('.html') &&
      (content.includes('Local design preview') ||
        content.includes('data-agentgrid-preview="local-only"'))
    ) {
      errors.push(`Unpublished local design preview in public export: ${name}`);
    }
    if (
      /sb_secret_[A-Za-z0-9_-]{12,}|sbp_(?:oauth_)?[a-f0-9]{40}|cfat_[A-Za-z0-9_-]{20,}|GOCSPX-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}/.test(
        content,
      )
    ) {
      errors.push(`Potential credential in public artifact: ${name}`);
    }
    for (const [key, value] of Object.entries(process.env)) {
      if (
        /^(SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|CLOUDFLARE_API_TOKEN|RESEND_API_KEY|GOOGLE_CLIENT_SECRET|AGENTGRID_ENVELOPE_KEYS|AGENTGRID_RATE_KEY)$/.test(
          key,
        ) &&
        value &&
        value.length >= 12 &&
        content.includes(value)
      ) {
        errors.push(`Privileged environment value in public artifact: ${name}`);
      }
      if (key === 'AGENTGRID_ENVELOPE_KEYS' && value) {
        try {
          const keys = JSON.parse(value);
          if (
            Array.isArray(keys) &&
            keys.some(
              (entry) =>
                typeof entry?.material === 'string' &&
                entry.material.length >= 12 &&
                content.includes(entry.material),
            )
          )
            errors.push(`Privileged encryption material in public artifact: ${name}`);
        } catch {
          /* Malformed configuration is separately rejected by the runtime. */
        }
      }
    }
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    const errors = await inspectExport(resolve('out'));
    for (const error of errors) console.error(error);
    if (errors.length) process.exitCode = 1;
    else
      console.log(
        'Static export verified: required artifacts present; no detected private/debug artifacts.',
      );
  } catch {
    console.error('Cannot inspect static export. Run the production build first.');
    process.exitCode = 1;
  }
}
