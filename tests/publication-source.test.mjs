import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPublicationSource } from '../backend/publication/source.ts';
const configuration = {
  origin: 'https://synthetic.supabase.co',
  key: 'sb_publishable_' + 'p'.repeat(24),
};
test('public capture sends only anonymous, origin-confined RPC requests with no session persistence', async () => {
  const calls = [];
  const rpc = publicPublicationSource(configuration, async (input, init) => {
    calls.push({ input, init });
    return Response.json({ revision: 0, items: [], hasMore: false });
  });
  assert.deepEqual(await rpc('agentgrid_publication_index', { after_id: null }), {
    revision: 0,
    items: [],
    hasMore: false,
  });
  assert.equal(calls.length, 1);
  assert.equal(
    String(calls[0].input),
    configuration.origin + '/rest/v1/rpc/agentgrid_publication_index',
  );
  assert.equal(calls[0].init.redirect, 'manual');
  assert.equal(calls[0].init.method, 'POST');
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get('apikey'), configuration.key);
  assert.equal(headers.get('cookie'), null);
  assert.equal(headers.get('authorization'), 'Bearer ' + configuration.key);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  await assert.rejects(rpc('agentgrid_publish_version', {}), /Only public/);
  assert.equal(calls.length, 1);
  for (const value of [
    { ...configuration, key: 'sb_secret_' + 'x'.repeat(24) },
    { ...configuration, origin: 'http://synthetic.supabase.co' },
    { ...configuration, origin: configuration.origin + '/rest' },
    { ...configuration, origin: 'https://synthetic.supabase.co.evil.test' },
  ])
    assert.throws(() => publicPublicationSource(value));
});
test('public capture refuses oversized, malformed, redirected and unavailable responses without leaking provider details', async () => {
  for (const reply of [
    () => new Response('private provider message', { status: 500 }),
    () => new Response('redirect', { status: 302, headers: { location: 'https://evil.test' } }),
    () => new Response('<html>not JSON</html>'),
    () => new Response('{invalid', { headers: { 'content-type': 'application/json' } }),
    () =>
      new Response('{}', {
        headers: { 'content-type': 'application/json', 'content-length': '300001' },
      }),
    () => new Response(' '.repeat(300001), { headers: { 'content-type': 'application/json' } }),
    () => {
      throw new Error('private provider message');
    },
  ]) {
    const rpc = publicPublicationSource(configuration, async () => reply());
    await assert.rejects(rpc('agentgrid_publication_index', {}), (error) => {
      assert.equal(error.message.includes('private provider message'), false);
      return true;
    });
  }
});
