import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  hardenDocument,
  verifyDocumentPolicy,
  documentHeaderPolicy,
} from '../scripts/static-csp.mjs';
import { hardenStatic } from '../scripts/harden-static.mjs';
import { documentSecurityHeaders } from '../src/domain/document-security.ts';
const page = (body = '') =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
test('policy hashes parsed inline bytes and rejects tampering, removed or late policies', () => {
  const script = 'self.example = "<not a tag>";\n';
  const original = page(
    `<script>${script}</script><script src="/_next/static/chunks/a.js" async></script><style>body{color:black}</style>`,
  );
  const hardened = hardenDocument(original),
    policy = verifyDocumentPolicy(hardened);
  assert.ok(policy.includes(`'sha256-${createHash('sha256').update(script).digest('base64')}'`));
  assert.ok(policy.includes("script-src-attr 'none'"));
  assert.equal(
    policy
      .split(';')
      .find((part) => part.trim().startsWith('script-src '))
      .includes('unsafe-'),
    false,
  );
  assert.ok(hardened.indexOf('agentgrid-csp') < hardened.indexOf('<script'));
  assert.throws(() => verifyDocumentPolicy(original));
  assert.throws(() => verifyDocumentPolicy(hardened.replace(script, script + 'self.injected=1;')));
  assert.throws(() =>
    verifyDocumentPolicy(
      hardened.replace("script-src-attr 'none'", "script-src-attr 'unsafe-inline'"),
    ),
  );
  const meta = hardened.match(/<meta id="agentgrid-csp"[^>]+>/)[0];
  assert.throws(() =>
    verifyDocumentPolicy(
      hardened
        .replace(meta, '')
        .replace('</head>', meta + '</head>')
        .replace('<meta charset="utf-8">', '<meta charset="utf-8"><title>late</title>'),
    ),
  );
  assert.throws(() => hardenDocument(hardened));
  // HTML's newline normalization is included in the browser's hashed text.
  assert.ok(
    verifyDocumentPolicy(hardenDocument(page('<script>one\r\ntwo</script>'))).includes(
      `'sha256-${createHash('sha256').update('one\ntwo').digest('base64')}'`,
    ),
  );
});
test('generated documents cannot smuggle executable attributes, external scripts or malformed markup', () => {
  for (const html of [
    page('<button onclick="alert(1)">bad</button>'),
    page('<svg onload="alert(1)"></svg>'),
    page('<base href="https://other.test/">'),
    page('<script src="https://other.test/a.js"></script>'),
    page('<script src="/_next/static/a.js">ignored payload</script>'),
    page('<script>unclosed'),
    page('<div id="one" id="two"></div>'),
    page().replace('<head>', '<head><script>tooEarly()</script>'),
    page().replace('utf-8', 'iso-8859-1'),
    page().replace('<meta charset="utf-8">', ''),
  ])
    assert.throws(() => hardenDocument(html));
});
test('export hardening is confined, complete, and never follows links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-csp-'));
  try {
    const out = join(root, 'out');
    await mkdir(out);
    await writeFile(join(out, 'index.html'), page('<script>one()</script>'));
    await mkdir(join(out, 'nested'));
    await writeFile(join(out, 'nested/index.html'), page('<script>two()</script>'));
    await hardenStatic(out);
    verifyDocumentPolicy(await readFile(join(out, 'nested/index.html'), 'utf8'));
    await assert.rejects(hardenStatic(out));
    await assert.rejects(hardenStatic(root));
    await writeFile(join(out, 'index.html'), page());
    await symlink(join(out, 'index.html'), join(out, 'alias.html'));
    await assert.rejects(hardenStatic(out));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('static and Function response headers agree and fit provider limits', async () => {
  const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
  assert.ok(headers.includes(documentHeaderPolicy));
  for (const [name, value] of Object.entries(documentSecurityHeaders))
    assert.ok(headers.toLowerCase().includes(`${name}: ${value}`.toLowerCase()));
  assert.ok(headers.split('\n').every((line) => line.length <= 2000));
});

test('only reel editor documents allow local blob media without granting executable or remote media authority', () => {
  const normal = verifyDocumentPolicy(hardenDocument(page('<main>Catalogue</main>')));
  assert.ok(!normal.includes('blob:'));
  const source = page('<section data-agentgrid-local-reels="1"><canvas></canvas></section>');
  const hardened = hardenDocument(source),
    policy = verifyDocumentPolicy(hardened);
  assert.ok(policy.includes("img-src 'self' data: blob:"));
  assert.ok(policy.includes("media-src 'self' blob:"));
  assert.equal(
    policy
      .split(';')
      .find((p) => p.trim().startsWith('script-src '))
      .trim(),
    "script-src 'self'",
  );
  assert.ok(policy.includes("connect-src 'self'"));
  assert.ok(!policy.includes('https://'));
  assert.throws(() =>
    verifyDocumentPolicy(
      hardened.replace('data-agentgrid-local-reels="1"', 'data-agentgrid-local-reels="0"'),
    ),
  );
});
