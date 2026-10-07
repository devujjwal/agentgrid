import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

export async function inspectExport(root) {
  const errors = [];
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else files.push(path);
    }
  }
  await visit(root);
  const required = ['index.html', '404.html', 'robots.txt', '_headers'];
  const names = new Set(files.map((file) => relative(root, file)));
  for (const name of required) {
    if (!names.has(name)) errors.push(`Missing static delivery artifact: ${name}`);
  }
  for (const path of files) {
    const name = relative(root, path);
    if (/(^|\/)\.env(?:\.|$)|\.map$|(^|\/)(backups|\.git)\//.test(name)) {
      errors.push(`Private/debug artifact in public export: ${name}`);
    }
    if (!/\.(html|js|json|txt|css)$/.test(name)) continue;
    const content = await readFile(path, 'utf8');
    if (
      /sb_secret_[A-Za-z0-9_-]{12,}|sbp_(?:oauth_)?[a-f0-9]{40}|cfat_[A-Za-z0-9_-]{20,}|GOCSPX-[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}/.test(
        content,
      )
    ) {
      errors.push(`Potential credential in public artifact: ${name}`);
    }
    for (const [key, value] of Object.entries(process.env)) {
      if (
        /^(SUPABASE_SECRET_KEY|SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|CLOUDFLARE_API_TOKEN|RESEND_API_KEY|GOOGLE_CLIENT_SECRET)$/.test(
          key,
        ) &&
        value &&
        value.length >= 12 &&
        content.includes(value)
      ) {
        errors.push(`Privileged environment value in public artifact: ${name}`);
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
