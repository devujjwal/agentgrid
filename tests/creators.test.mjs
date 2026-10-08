import test from 'node:test';
import assert from 'node:assert/strict';
import { creatorFixture } from './fixtures/creator.mjs';
import { publicCreatorData } from '../backend/community/creators.ts';
import { creatorPageHandler } from '../backend/http/creators.ts';
import { publicCreatorHandler } from '../backend/http/creator-api.ts';
import { creatorDocument } from '../backend/community/creator-document.ts';
import { safeCreatorWebsite } from '../src/domain/creator.ts';
import { signInReturnPath } from '../src/domain/session.ts';
const origin = 'https://agentgrid-staging.pages.dev';
const config = {
  stage: 'preview',
  origin,
  supabaseOrigin: 'https://synthetic.supabase.co',
  publishableKey: 'sb_publishable_' + 'p'.repeat(24),
};
const creator = { ...creatorFixture, offset: 0, hasMore: false };
test('creator projection uses anonymous authority, bounded pages and closed data', async () => {
  let value = creatorFixture,
    calls = 0;
  const read = publicCreatorData(config, async (input, init) => {
    calls++;
    assert.equal(
      String(input),
      'https://synthetic.supabase.co/rest/v1/rpc/agentgrid_public_creator_page',
    );
    assert.equal(new Headers(init.headers).get('apikey'), config.publishableKey);
    assert.equal(init.redirect, 'error');
    assert.deepEqual(JSON.parse(init.body), { handle: 'synthetic_creator', requested_offset: 0 });
    return Response.json(value);
  });
  assert.deepEqual(await read('synthetic_creator'), creator);
  for (const [name, offset] of [
    ['bad@name', 0],
    ['synthetic_creator', 1],
    ['synthetic_creator', 10000],
  ])
    await assert.rejects(read(name, offset));
  assert.equal(calls, 1);
  value = { ...creatorFixture, auth_user_id: 'private' };
  await assert.rejects(read('synthetic_creator'));
  value = { ...creatorFixture, username: 'different_creator' };
  await assert.rejects(read('synthetic_creator'));
  value = null;
  assert.equal(await read('synthetic_creator'), null);
  value = {
    ...creatorFixture,
    agents: Array.from({ length: 21 }, (_, i) => ({
      ...creatorFixture.agents[0],
      id: '20000000-0000-4000-8000-' + String(i).padStart(12, '0'),
    })),
  };
  const paged = await read('synthetic_creator');
  assert.equal(paged.agents.length, 20);
  assert.equal(paged.hasMore, true);
});
test('creator HTML is crawlable, escaped, script-free and private by live availability', async () => {
  let value = creator,
    calls = 0;
  const handler = creatorPageHandler(origin, async () => {
    calls++;
    return value;
  });
  const send = (path, options) => handler(new Request(origin + path, options));
  const response = await send('/creators/synthetic_creator/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, follow');
  assert.match(response.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await response.text();
  assert.match(html, /Published contributions/);
  assert.match(html, /href="https:\/\/agentgrid.me\/creators\/synthetic_creator\/"/);
  assert.match(html, /workspace\/report\/\?creator=synthetic_creator/);
  assert.ok(!html.includes('<script'));
  const hostile = creatorDocument(
    {
      ...creator,
      displayName: '<script>alert(1)</script>',
      bio: '<img src=x onerror=alert(1)>',
      website: 'javascript:alert(1)',
    },
    200,
  );
  assert.ok(!hostile.includes('<script'));
  assert.ok(!hostile.includes('<img'));
  assert.ok(!hostile.includes('href="javascript:'));
  assert.match(hostile, /&lt;script&gt;/);
  for (const url of [
    'javascript:alert(1)',
    'http://example.test',
    'https://user:secret@example.test',
  ])
    assert.equal(safeCreatorWebsite(url), null);
  assert.equal(safeCreatorWebsite('https://example.test/'), 'https://example.test/');
  const before = calls;
  for (const path of [
    '/creators/synthetic_creator/?offset=1',
    '/creators/synthetic_creator/?offset=20&offset=40',
    '/creators/synthetic_creator/?x=1',
    '/creators/bad%40name/',
    '/creators/synthetic_creator/index.html',
  ])
    assert.equal((await send(path)).status, 404);
  assert.equal(calls, before);
  assert.equal((await send('/creators/synthetic_creator/', { method: 'POST' })).status, 405);
  value = null;
  assert.equal((await send('/creators/synthetic_creator/')).status, 404);
  const unavailable = creatorPageHandler(origin, async () => {
    throw new Error('private provider detail');
  });
  const failure = await unavailable(new Request(origin + '/creators/synthetic_creator/'));
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes('private provider detail'));
  assert.equal(
    await (
      await unavailable(new Request(origin + '/creators/synthetic_creator/', { method: 'HEAD' }))
    ).text(),
    '',
  );
});
test('creator reporting context is public-only, exact and isolated from redirects', async () => {
  let value = creator;
  const handler = publicCreatorHandler(origin, async () => value);
  const response = await handler(
    new Request(origin + '/api/community/creator/?username=synthetic_creator'),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), creator);
  for (const path of [
    '?username=synthetic_creator&email=private',
    '?username=bad%40name',
    '?username=one&username=two',
  ])
    assert.equal(
      (await handler(new Request(origin + '/api/community/creator/' + path))).status,
      400,
    );
  assert.equal(
    (
      await handler(
        new Request(origin + '/api/community/creator/?username=synthetic_creator', {
          headers: { 'sec-fetch-site': 'cross-site' },
        }),
      )
    ).status,
    403,
  );
  value = null;
  assert.equal(
    (await handler(new Request(origin + '/api/community/creator/?username=synthetic_creator')))
      .status,
    404,
  );
  for (const path of [
    '/workspace/report/?creator=synthetic_creator',
    '/creators/synthetic_creator/',
  ])
    assert.equal(signInReturnPath(path), path);
  for (const path of [
    '/workspace/report/?creator=synthetic_creator&next=https://evil.test',
    '/creators/a%2fb/',
    '//evil.test/creators/synthetic_creator/',
  ])
    assert.equal(signInReturnPath(path), '/workspace/');
});

test('creator transport refuses oversized public responses', async () => {
  const read = publicCreatorData(
    config,
    async () =>
      new Response(' '.repeat(100001), { headers: { 'content-type': 'application/json' } }),
  );
  await assert.rejects(read('synthetic_creator'));
});
