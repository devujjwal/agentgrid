import test from 'node:test';
import assert from 'node:assert/strict';
import { providerFetch } from '../backend/http/provider-fetch.ts';

test('provider redirects never forward credentials, expose Location, read bodies or retry', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    let calls = 0,
      cancelled = false;
    const transport = async (input, init) => {
      calls++;
      assert.equal(input, 'https://synthetic.supabase.co/rest/v1/rpc/agentgrid_auth_allow');
      assert.equal(init.redirect, 'manual');
      assert.equal(init.headers.Authorization, 'Bearer synthetic-only');
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
        {
          status,
          headers: { Location: 'https://untrusted.example.test/private?value=synthetic' },
        },
      );
    };
    await assert.rejects(
      providerFetch(transport, 'https://synthetic.supabase.co/rest/v1/rpc/agentgrid_auth_allow', {
        method: 'POST',
        headers: { Authorization: 'Bearer synthetic-only' },
      }),
      { message: 'Provider redirect refused.' },
    );
    assert.equal(calls, 1);
    assert.equal(cancelled, true);
  }
});
