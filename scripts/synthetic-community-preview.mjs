/** Disposable loopback UI acceptance. All provider/database responses are
 * synthetic memory fixtures; no env credentials, email or external fetch. */
import { Readable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import { identityFixture, syntheticConfiguration } from '../tests/fixtures/identity.mjs';
import { identityRuntime } from '../backend/auth/runtime.ts';
import { identityHandler } from '../backend/http/identity.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { workspaceData } from '../backend/workspace/data.ts';
import { privateFailure } from '../backend/http/guard.ts';
import { newDraft } from '../src/domain/draft.ts';
import { isLaterVersion } from '../src/domain/versions.ts';

export async function syntheticCommunityPreview() {
  if (
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    !process.argv.includes('--synthetic-community-qa') ||
    process.argv.includes('--owner-live-auth')
  )
    throw new Error('Explicit disposable local acceptance required.');
  for (const name of [
    'SUPABASE_SECRET_KEY',
    'SUPABASE_ACCESS_TOKEN',
    'RESEND_API_KEY',
    'CLOUDFLARE_API_TOKEN',
  ])
    if (process.env[name])
      throw new Error('Synthetic acceptance refuses inherited provider credentials.');
  const configuration = {
    ...syntheticConfiguration(),
    stage: 'development',
    origin: 'http://localhost:3027',
    pilotEmails: ['owner@example.test'],
  };
  const fixture = await identityFixture();
  fixture.managed.startGoogle = async () => {
    throw new Error('No outbound provider in synthetic acceptance.');
  };
  const runtime = await identityRuntime(configuration, fixture.store, fixture.managed, fixture.now);
  const identity = identityHandler(runtime, async () => {});
  const profile = {
    id: '10000000-0000-4000-8000-000000000001',
    username: 'synthetic_owner',
    displayName: 'Synthetic local owner',
    bio: '',
    website: null,
    visibility: 'private',
    status: 'active',
  };
  const resourceId = '20000000-0000-4000-8000-000000000001';
  const resources = new Map([
    [
      resourceId,
      {
        specification: newDraft(
          'Synthetic meal planning resource',
          'synthetic-meal-planning',
          'everyday',
          'chatgpt',
        ),
        revision: 1,
        updatedAt: '2026-10-07T00:00:00Z',
      },
    ],
  ]);
  const frozenVersions = new Map();
  const privateReports = new Map();
  let reportAcknowledgementUnavailable = false;
  let submissionsOpen = true;
  const transport = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== configuration.supabaseOrigin) throw new Error('Outbound traffic refused.');
    const headers = new Headers(init.headers);
    if (
      headers.get('apikey') !== configuration.publishableKey ||
      !headers.get('authorization')?.startsWith('Bearer synthetic-access-')
    )
      throw new Error('Synthetic user bearer required.');
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.pathname.endsWith('/agentgrid_workspace_identity'))
      return Response.json({
        profile,
        roles: [],
        onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
      });
    if (profile.status !== 'active')
      return Response.json(
        { code: '42501', message: 'Synthetic membership denied' },
        { status: 403 },
      );
    const agent = (id, record) => ({
      id,
      slug: record.specification.identity.slug,
      status: 'active',
      forked_from_version_id: null,
      created_at: record.updatedAt,
    });
    if (url.pathname.endsWith('/agentgrid_agents')) {
      if (url.searchParams.get('owner_id') !== 'eq.' + profile.id)
        throw new Error('Owner filter missing.');
      if (url.searchParams.has('id')) {
        const id = url.searchParams.get('id').slice(3),
          record = resources.get(id);
        return Response.json(record ? agent(id, record) : null);
      }
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return Response.json(
        [...resources].map(([id, record]) => agent(id, record)).slice(offset, offset + 21),
      );
    }
    if (url.pathname.endsWith('/agentgrid_drafts')) {
      const record = resources.get(url.searchParams.get('agent_id')?.slice(3));
      return Response.json(
        record
          ? {
              specification: record.specification,
              editorial: {},
              revision: record.revision,
              updated_at: record.updatedAt,
            }
          : null,
      );
    }
    if (url.pathname.endsWith('/agentgrid_create_agent')) {
      if (resources.size >= 10) return Response.json({ code: 'P0001' }, { status: 429 });
      if (
        [...resources.values()].some(
          (record) => record.specification.identity.slug === body.requested_slug,
        )
      )
        return Response.json({ code: '23505' }, { status: 409 });
      if (body.source_version_id !== null || Object.keys(body.initial_editorial).length)
        throw new Error('Unexpected synthetic creation authority.');
      const id = randomUUID();
      resources.set(id, {
        specification: body.initial_specification,
        revision: 1,
        updatedAt: new Date().toISOString(),
      });
      return Response.json(id);
    }
    if (url.pathname.endsWith('/agentgrid_save_draft')) {
      const record = resources.get(body.resource_id);
      if (!record || body.expected_revision !== record.revision)
        return Response.json(
          { code: '40001', message: 'Synthetic competing revision' },
          { status: 409 },
        );
      record.specification = body.updated_specification;
      record.updatedAt = new Date().toISOString();
      return Response.json(++record.revision);
    }
    if (url.pathname.endsWith('/agentgrid_owned_versions')) {
      if (!resources.has(body.resource_id))
        return Response.json({ code: '42501' }, { status: 403 });
      const rows = [...frozenVersions.values()]
        .filter((version) => version.agent_id === body.resource_id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
      const latest = rows.reduce(
        (version, row) =>
          version === null || isLaterVersion(row.version, version) ? row.version : version,
        null,
      );
      return Response.json({
        submissionEnabled: submissionsOpen,
        pendingVersionId: rows.find((row) => row.state === 'pending')?.id ?? null,
        latestVersion: latest,
        versions: rows.slice(body.requested_offset, body.requested_offset + 21).map((row) => ({
          id: row.id,
          version: row.version,
          contentDigest: row.content_digest,
          submittedAt: row.created_at,
          state: row.state,
          reason: row.reason,
          reviewedAt: row.reviewed_at,
        })),
      });
    }
    if (url.pathname.endsWith('/agentgrid_owned_version_document')) {
      const row = frozenVersions.get(body.resource_version_id);
      if (!resources.has(body.resource_id) || row?.agent_id !== body.resource_id)
        return Response.json({ code: '42501' }, { status: 403 });
      return Response.json({
        resourceId: body.resource_id,
        sourceVersionId: null,
        record: {
          id: row.id,
          version: row.version,
          contentDigest: row.content_digest,
          submittedAt: row.created_at,
          state: row.state,
          reason: row.reason,
          reviewedAt: row.reviewed_at,
        },
        specification: row.specification,
      });
    }
    if (url.pathname.endsWith('/agentgrid_owned_reports')) {
      if (body.report_resource_id !== null)
        return Response.json(
          reportAcknowledgementUnavailable
            ? []
            : [...privateReports.values()].filter((row) => row.id === body.report_resource_id),
        );
      return Response.json(
        [...privateReports.values()]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
          .slice(body.requested_offset, body.requested_offset + 21),
      );
    }
    if (url.pathname.endsWith('/agentgrid_create_report')) {
      if (body.target_kind !== 'agent' || body.target_id !== '00000000-0000-4000-8000-000000000001')
        return Response.json({ code: '42501' }, { status: 403 });
      if (
        [...privateReports.values()].some(
          (row) =>
            row.targetId === body.target_id &&
            row.category === body.report_category &&
            row.state === 'open',
        )
      )
        return Response.json({ code: '23505' }, { status: 409 });
      if (privateReports.size >= 10) return Response.json({ code: 'P0001' }, { status: 429 });
      const id = randomUUID();
      privateReports.set(id, {
        id,
        targetKind: body.target_kind,
        targetId: body.target_id,
        category: body.report_category,
        explanation: body.details,
        state: 'open',
        resolution: '',
        resolvedAt: null,
        createdAt: new Date().toISOString(),
      });
      return Response.json(id);
    }
    if (url.pathname.endsWith('/agentgrid_submit_version')) {
      if (!submissionsOpen) return Response.json({ code: '42501' }, { status: 403 });
      const record = resources.get(body.resource_id);
      if (!record) return Response.json({ code: '42501' }, { status: 403 });
      if (record.revision !== body.expected_revision)
        return Response.json({ code: '40001' }, { status: 409 });
      const existing = [...frozenVersions.values()].filter(
        (version) => version.agent_id === body.resource_id,
      );
      if (
        existing.some(
          (version) =>
            version.state === 'pending' ||
            !isLaterVersion(record.specification.version, version.version),
        )
      )
        return Response.json({ code: '23505' }, { status: 409 });
      const id = randomUUID();
      frozenVersions.set(id, {
        id,
        agent_id: body.resource_id,
        submitted_by: profile.id,
        version: record.specification.version,
        specification: structuredClone(record.specification),
        content_digest: createHash('sha256')
          .update(JSON.stringify(record.specification))
          .digest('hex'),
        created_at: new Date().toISOString(),
        state: 'pending',
        reason: '',
        reviewed_at: null,
      });
      return Response.json(id);
    }
    if (url.pathname.endsWith('/agentgrid_agent_versions')) {
      if (url.searchParams.get('submitted_by') !== 'eq.' + profile.id)
        throw new Error('Owned version filter required.');
      const row = frozenVersions.get(url.searchParams.get('id')?.slice(3));
      return Response.json(
        row && url.searchParams.get('agent_id') === 'eq.' + row.agent_id
          ? {
              id: row.id,
              agent_id: row.agent_id,
              submitted_by: row.submitted_by,
              version: row.version,
              content_digest: row.content_digest,
              created_at: row.created_at,
            }
          : null,
      );
    }
    if (url.pathname.endsWith('/agentgrid_submissions')) {
      const row = frozenVersions.get(url.searchParams.get('version_id')?.slice(3));
      return Response.json(
        row ? { state: row.state, reason: row.reason, reviewed_at: row.reviewed_at } : null,
      );
    }
    if (url.pathname.endsWith('/agentgrid_decide_submission')) {
      const row = frozenVersions.get(body.submitted_version_id);
      if (!row || row.state !== 'pending' || body.decision !== 'withdrawn')
        return Response.json({ code: '42501' }, { status: 403 });
      row.state = 'withdrawn';
      row.reason = body.explanation;
      row.reviewed_at = new Date().toISOString();
      return Response.json(null);
    }
    if (url.pathname.endsWith('/agentgrid_update_profile')) {
      profile.displayName = body.requested_display_name;
      profile.bio = body.requested_bio;
      profile.website = body.requested_website;
      return Response.json(profile.id);
    }
    if (url.pathname.endsWith('/agentgrid_set_profile_visibility')) {
      profile.visibility = body.make_public ? 'public' : 'private';
      return Response.json(null);
    }
    if (url.pathname.endsWith('/agentgrid_saved_agents')) return Response.json([]);
    throw new Error('Unexpected synthetic fixture operation.');
  };
  const workspace = workspaceHandler(runtime, (session) =>
    workspaceData(configuration, session, transport),
  );
  return {
    async request(incoming, outgoing) {
      try {
        if (incoming.headers.host !== 'localhost:3027') throw new Error('Loopback host required.');
        if (incoming.url === '/qa-tools.js' && incoming.method === 'GET') {
          outgoing
            .writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
            .end(
              `window.addEventListener('load',()=>setTimeout(()=>{
                if(document.querySelector('[data-qa-tools]'))return;
                const tools=document.createElement('aside');tools.dataset.qaTools='synthetic';
                tools.style.cssText='padding:1rem;border-top:1px solid';
                tools.innerHTML='<p>Synthetic community acceptance — disposable memory-only state. Sign in with owner@example.test and code 12345678; no real email is sent.</p><button data-qa-action="compete">Simulate competing revision</button><button data-qa-action="suspend">Suspend synthetic member</button><button data-qa-action="resume">Resume synthetic member</button><button data-qa-action="revoke">Revoke synthetic session</button><button data-qa-action="close-submissions">Close synthetic submissions</button><button data-qa-action="open-submissions">Open synthetic submissions</button><button data-qa-action="resolve-report">Resolve first synthetic report</button><button data-qa-action="fail-report-ack">Fail synthetic report acknowledgement</button><button data-qa-action="restore-report-ack">Restore synthetic report acknowledgement</button><p data-qa-status role="status"></p>';
                document.body.append(tools);
                tools.querySelectorAll('[data-qa-action]').forEach(button=>button.addEventListener('click',async()=>{try{const response=await fetch('/qa-control/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:button.dataset.qaAction})});tools.querySelector('[data-qa-status]').textContent=response.ok?'Synthetic state changed; reconnect the editor.':'Synthetic action refused.';}catch{tools.querySelector('[data-qa-status]').textContent='Synthetic control unavailable.';}}));
              },200));`,
            );
          return;
        }
        if (incoming.url === '/qa-control/' && incoming.method === 'POST') {
          if (
            incoming.headers.origin !== configuration.origin ||
            incoming.headers['content-type'] !== 'application/json'
          )
            throw new Error('Origin required.');
          const chunks = [];
          let count = 0;
          for await (const chunk of incoming) {
            count += chunk.length;
            if (count > 100) throw new Error('Control bounds');
            chunks.push(chunk);
          }
          const action = JSON.parse(Buffer.concat(chunks).toString('utf8')).action;
          if (action === 'compete') resources.get(resourceId).revision++;
          else if (action === 'suspend') profile.status = 'suspended';
          else if (action === 'resume') profile.status = 'active';
          else if (action === 'revoke') fixture.sessions.clear();
          else if (action === 'close-submissions') submissionsOpen = false;
          else if (action === 'open-submissions') submissionsOpen = true;
          else if (action === 'fail-report-ack') reportAcknowledgementUnavailable = true;
          else if (action === 'restore-report-ack') reportAcknowledgementUnavailable = false;
          else if (action === 'resolve-report') {
            const row = [...privateReports.values()].find((report) => report.state === 'open');
            if (!row) throw new Error('No open synthetic report');
            row.state = 'resolved';
            row.resolvedAt = new Date().toISOString();
            row.resolution =
              'Synthetic moderator response for private acceptance only; no real moderation occurred.';
          } else throw new Error('Unknown synthetic control');
          outgoing
            .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
            .end('{"synthetic":true}');
          return;
        }
        const request = new Request(configuration.origin + incoming.url, {
          method: incoming.method,
          headers: incoming.headers,
          ...(['GET', 'HEAD'].includes(incoming.method)
            ? {}
            : { body: Readable.toWeb(incoming), duplex: 'half' }),
        });
        const response = incoming.url.startsWith('/api/workspace/')
          ? await workspace(request)
          : await identity(request, '192.0.2.9');
        for (const [key, value] of response.headers)
          if (key !== 'set-cookie') outgoing.setHeader(key, value);
        const cookies = response.headers.getSetCookie();
        if (cookies.length) outgoing.setHeader('Set-Cookie', cookies);
        outgoing.writeHead(response.status).end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        const response = privateFailure(error);
        outgoing
          .writeHead(response.status, Object.fromEntries(response.headers))
          .end(await response.text());
      }
    },
    close: async () => {
      fixture.sessions.clear();
      fixture.flows.clear();
    },
  };
}
