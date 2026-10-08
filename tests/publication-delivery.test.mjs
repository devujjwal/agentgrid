import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deliveryGuard } from '../backend/publication/delivery.ts';
import { publicCatalogueChecksum } from '../src/domain/publication-snapshot.ts';
import { readPublication } from '../scripts/verify-publication.mjs';
const resource = {
  resourceId: '20000000-0000-4000-8000-000000000001',
  versionId: '30000000-0000-4000-8000-000000000001',
  slug: 'synthetic-agent',
  tag: 'a'.repeat(64),
};
const manifest = {
  contract_version: '0.1',
  source_revision: 1,
  captured_at: '2026-10-08T00:00:00Z',
  catalogue_sha256: 'b'.repeat(64),
  resources: [resource],
};
const request = (path, method = 'GET') => new Request('https://agentgrid.me' + path, { method });
test('detail aliases and RSC payloads require current delivery identity and never cache instructions', async () => {
  let reads = 0,
    deliveries = 0;
  const guard = deliveryGuard(manifest, async (slug) => {
    assert.equal(slug, resource.slug);
    reads++;
    return resource;
  });
  const assets = async () => {
    deliveries++;
    return new Response('instructions', {
      headers: { etag: 'old', 'last-modified': 'old', 'cache-control': 'public, max-age=3600' },
    });
  };
  for (const path of [
    '/agents/synthetic-agent/',
    '/agents/synthetic-agent',
    '/agents/synthetic-agent.html',
    '/agents/synthetic-agent.txt',
    '/agents/synthetic-agent/index.html',
    '/agents/synthetic-agent/index.txt',
    '/agents/synthetic-agent/__next._full.txt?_rsc=one',
    '/agents/synthetic-agent/__next.agents.$d$slug.__PAGE__.txt',
  ]) {
    const response = await guard(request(path), assets);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'instructions');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
    assert.equal(response.headers.get('etag'), null);
    assert.equal(response.headers.get('last-modified'), null);
  }
  assert.equal(reads, 8);
  assert.equal(deliveries, 8);
  const head = await guard(request('/agents/synthetic-agent/', 'HEAD'), assets);
  assert.equal(await head.text(), '');
  assert.equal(head.status, 200);
});
test('withdrawal, changed publication, failed provider, malformed data and encoded aliases withhold static content', async () => {
  const never = async () => {
    assert.fail('Unapproved static content reached assets');
  };
  for (const [value, status] of [
    [null, 410],
    [{ ...resource, tag: 'c'.repeat(64) }, 503],
    [{ ...resource, versionId: '30000000-0000-4000-8000-000000000002' }, 503],
    [{ ...resource, slug: 'other' }, 503],
    [{ ...resource, private: 'leak' }, 503],
  ]) {
    const response = await deliveryGuard(manifest, async () => value)(
      request('/agents/synthetic-agent/'),
      never,
    );
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
  }
  const guard = deliveryGuard(manifest, async () => {
    throw new Error('provider secret');
  });
  const unavailable = await guard(request('/agents/synthetic-agent/'), never);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.text()).includes('provider secret'), false);
  for (const path of [
    '/agents/unknown/',
    '/agents/%73ynthetic-agent/',
    '/agents/synthetic-agent%2findex.txt',
    '/agents/index.html/extra',
  ])
    assert.equal((await guard(request(path), never)).status, 404);
  assert.equal((await guard(request('/agents/synthetic-agent/', 'POST'), never)).status, 404);
});
test('static listing is provider-independent; conditional or ranged content is never accepted as a detail', async () => {
  const guard = deliveryGuard(manifest, async () => resource);
  for (const path of ['/agents/', '/agents/index.txt', '/agents/__next._full.txt']) {
    const response = await deliveryGuard(manifest, async () => {
      assert.fail('Listing should not query database');
    })(request(path), async () => new Response('listing'));
    assert.equal(await response.text(), 'listing');
  }
  for (const status of [206, 304])
    assert.equal(
      (await guard(request('/agents/synthetic-agent/'), async () => new Response(null, { status })))
        .status,
      503,
    );
});
test('build input gate accepts exact digest and refuses mismatched, unknown or malformed inventory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-publication-'));
  try {
    const catalogue = { contract_version: '0.1', resources: [] };
    const delivery = {
      ...manifest,
      resources: [],
      catalogue_sha256: await publicCatalogueChecksum(catalogue),
    };
    await writeFile(join(root, 'catalogue.json'), JSON.stringify(catalogue));
    await writeFile(join(root, 'delivery.json'), JSON.stringify(delivery));
    assert.equal((await readPublication(root)).catalogue.resources.length, 0);
    for (const invalid of [
      { ...delivery, catalogue_sha256: 'c'.repeat(64) },
      { ...delivery, resources: [resource] },
      { ...delivery, secret: 'not public' },
    ]) {
      await writeFile(join(root, 'delivery.json'), JSON.stringify(invalid));
      await assert.rejects(readPublication(root));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
