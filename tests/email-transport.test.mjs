import assert from 'node:assert/strict';
import test from 'node:test';
import { sendSignInEmail } from '../backend/email/resend.ts';

const configuration = {
  apiKey: 're_test_0123456789abcdefghij',
  fromEmail: 'signin@mail.agentgrid.me',
};
const email = {
  recipient: 'recipient@example.com',
  code: '12345678',
  expiresInMinutes: 60,
  challengeId: '692af3ce-c310-4943-a7e5-1d8b1d99c8da',
};
const receiptId = 'f8141f7e-d1fa-4427-8573-7a9b756e8ddb';

test('sign-in transport confines credentials and code to the intended provider', async () => {
  let request;
  const result = await sendSignInEmail(configuration, email, async (url, options) => {
    request = { url, options };
    return Response.json({ id: receiptId });
  });
  assert.deepEqual(result, { receiptId });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.redirect, 'manual');
  assert.equal(request.options.headers.Authorization, `Bearer ${configuration.apiKey}`);
  assert.equal(request.options.headers['Idempotency-Key'], `agentgrid_signin_${email.challengeId}`);
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.to, [email.recipient]);
  assert.equal(body.from, 'AgentGrid <signin@mail.agentgrid.me>');
  assert.match(body.text, /12345678/);
  assert.match(body.text, /60 minutes/);
  assert.ok(!body.subject.includes(email.code));
  assert.ok(!('html' in body));
  assert.ok(!JSON.stringify(result).includes(email.code));
});

test('malformed identities, injected headers and unsafe content never reach the network', async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return Response.json({ id: receiptId });
  };
  for (const change of [
    { recipient: 'recipient@example.com\r\nBcc: attacker@example.com' },
    { recipient: 'Name <recipient@example.com>' },
    { code: '<img src=x onerror=alert(1)>' },
    { expiresInMinutes: 0 },
    { expiresInMinutes: 61 },
    { challengeId: '../recipient@example.com' },
  ]) {
    await assert.rejects(sendSignInEmail(configuration, { ...email, ...change }, transport), {
      code: 'invalid-input',
    });
  }
  await assert.rejects(
    sendSignInEmail({ ...configuration, fromEmail: 'sender@email.ujjwal.in' }, email, transport),
    { code: 'invalid-input' },
  );
  await assert.rejects(
    sendSignInEmail({ ...configuration, apiKey: 'bad\nheader' }, email, transport),
    { code: 'invalid-input' },
  );
  assert.equal(calls, 0);
});

test('provider failures cannot leak echoed OTPs or privileged credentials', async () => {
  for (const transport of [
    async () => {
      throw new Error(`${configuration.apiKey} ${email.code}`);
    },
    async () =>
      Response.json({ message: `${configuration.apiKey} ${email.code}` }, { status: 429 }),
    async () => new Response(`${configuration.apiKey} ${email.code}`),
    async () => Response.json({ id: email.code }),
  ]) {
    await assert.rejects(sendSignInEmail(configuration, email, transport), (error) => {
      assert.ok(!String(error).includes(configuration.apiKey));
      assert.ok(!String(error).includes(email.code));
      assert.ok(!error.cause);
      return true;
    });
  }
});
