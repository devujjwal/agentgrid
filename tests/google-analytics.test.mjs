import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyticsPermitted,
  publicMeasurementPath,
  publicPageEvent,
} from '../src/analytics/google-policy.ts';
import { hardenDocument, verifyDocumentPolicy } from '../scripts/static-csp.mjs';
test('GA requires canonical production, affirmative consent and permitted privacy signals', () => {
  assert.equal(analyticsPermitted('https://agentgrid.me', 'granted', null, false), true);
  for (const origin of [
    'http://agentgrid.me',
    'https://www.agentgrid.me',
    'https://agentgrid-staging.pages.dev',
    'https://localhost',
  ])
    assert.equal(analyticsPermitted(origin, 'granted', null, false), false);
  for (const choice of [null, '', 'denied', 'yes'])
    assert.equal(analyticsPermitted('https://agentgrid.me', choice, null, false), false);
  assert.equal(analyticsPermitted('https://agentgrid.me', 'granted', '1', false), false);
  assert.equal(analyticsPermitted('https://agentgrid.me', 'granted', null, true), false);
});
test('GA denies private, legal and unknown paths and never forwards query or fragment input', () => {
  for (const path of [
    '/sign-in/',
    '/auth/callback',
    '/workspace/',
    '/workspace/agent/',
    '/saves/',
    '/privacy/',
    '/terms/',
    '/agents/?email=secret',
    '/agents/inbox/#private',
    '/agents/person@example.com/',
    '/agents/a/b/',
    '//other.test/',
  ]) {
    assert.equal(publicMeasurementPath(path), null);
    assert.equal(publicPageEvent(path), null);
  }
  assert.deepEqual(publicPageEvent('/agents/inbox-priority-triage/'), {
    page_location: 'https://agentgrid.me/agents/inbox-priority-triage/',
    page_referrer: '',
    page_title: 'AgentGrid',
    send_to: 'G-QFECS8NSVF',
  });
});
test('Google network CSP authority is confined to marked public catalogue documents', () => {
  const page = (body) =>
    `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`;
  const privatePolicy = verifyDocumentPolicy(hardenDocument(page('<div>private workspace</div>')));
  assert.equal(privatePolicy.includes('google'), false);
  const publicPolicy = verifyDocumentPolicy(
    hardenDocument(page('<div data-agentgrid-ga4="G-QFECS8NSVF"></div>')),
  );
  assert.ok(publicPolicy.includes('https://www.googletagmanager.com'));
  assert.ok(publicPolicy.includes('https://region1.google-analytics.com'));
  assert.equal(publicPolicy.includes("script-src 'unsafe-inline'"), false);
  assert.throws(() =>
    hardenDocument(page('<script src="https://untrusted.example/script.js"></script>')),
  );
});
