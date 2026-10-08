/** Disposable loopback UI acceptance. All provider/database responses are
 * synthetic memory fixtures; no env credentials, email or external fetch. */
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { identityFixture, syntheticConfiguration } from '../tests/fixtures/identity.mjs';
import { identityRuntime } from '../backend/auth/runtime.ts';
import { identityHandler } from '../backend/http/identity.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { moderationHandler } from '../backend/http/moderation.ts';
import { workspaceData } from '../backend/workspace/data.ts';
import { privateFailure } from '../backend/http/guard.ts';
import { newDraft } from '../src/domain/draft.ts';
import { publicCommunityHandler } from '../backend/http/community.ts';
import { publicReviewData } from '../backend/community/reviews.ts';
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
  const reviewTarget = '00000000-0000-4000-8000-000000000001';
  let reviewVersion = { id: '00000000-0000-4000-8000-000000000002', version: '1.0.0' };
  let ownReview = null,
    reviewAcknowledgementUnavailable = false,
    reviewBlocked = false,
    reviewOwnSource = false;
  let pagingReviews = [];
  const reviewPublic = () =>
    ownReview?.state === 'published' && profile.status === 'active'
      ? [
          {
            id: ownReview.id,
            usedVersionId: ownReview.usedVersionId,
            version: ownReview.version,
            rating: ownReview.rating,
            title: ownReview.title,
            body: ownReview.body,
            experience: ownReview.experience,
            createdAt: ownReview.createdAt,
            updatedAt: ownReview.updatedAt,
            author: { name: 'Community member', username: null },
          },
        ]
      : [];
  const publicTransport = async (input, init) => {
    const url = new URL(String(input)),
      headers = new Headers(init.headers),
      body = JSON.parse(init.body);
    if (
      url.origin !== configuration.supabaseOrigin ||
      !url.pathname.endsWith('/agentgrid_public_reviews') ||
      headers.get('apikey') !== configuration.publishableKey ||
      headers.get('authorization') !== 'Bearer ' + configuration.publishableKey
    )
      throw new Error('Synthetic anonymous projection required.');
    if (body.resource_id !== reviewTarget || reviewBlocked) return Response.json(null);
    const reviews = [...reviewPublic(), ...pagingReviews];
    return Response.json({
      resourceId: reviewTarget,
      reviewCount: reviews.length,
      averageRating: reviews.length
        ? Number((reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length).toFixed(2))
        : null,
      reviews: reviews.slice(body.requested_offset, body.requested_offset + 21),
    });
  };
  let syntheticStaff = false,
    failStaffAck = false;
  const staffReviews = new Map();
  const staffReports = new Map();
  let failStaffReportAck = false;
  const capturedAgent = JSON.parse(
    await readFile(
      new URL('../content/agents/inbox-priority-triage/1.0.0.agent.json', import.meta.url),
      'utf8',
    ),
  );
  const forkSourceId = '70000000-0000-4000-8000-000000000001';
  let forkSourceBlocked = false,
    failForkAck = false;
  const forkLicense = {
    identifier: 'CC-BY-4.0',
    statement:
      'Synthetic license for disposable fork acceptance only; no actual package licensing claim.',
    permissions: { use: true, modify: true, redistribute: true, public_fork: true },
  };
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
        roles: syntheticStaff ? ['moderator'] : [],
        onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
      });
    if (profile.status !== 'active')
      return Response.json(
        { code: '42501', message: 'Synthetic membership denied' },
        { status: 403 },
      );
    if (url.pathname.endsWith('/agentgrid_fork_source'))
      return Response.json(
        body.source_version_id === forkSourceId && !forkSourceBlocked
          ? {
              sourceVersionId: forkSourceId,
              resourceId: reviewTarget,
              slug: 'synthetic-fork-source',
              name: 'Synthetic Inbox Source',
              version: '1.0.0',
              creatorName: 'Synthetic source creator',
              license: forkLicense,
            }
          : null,
      );
    if (url.pathname.endsWith('/agentgrid_fork_agent')) {
      const existing = [...resources].find(
        ([, record]) => record.specification.identity.slug === body.requested_slug,
      );
      if (existing) {
        if (existing[1].sourceVersionId !== body.source_version_id)
          return Response.json({ code: '23505' }, { status: 409 });
        return Response.json({
          resourceId: existing[0],
          sourceVersionId: body.source_version_id,
          slug: body.requested_slug,
          created: false,
        });
      }
      if (forkSourceBlocked || body.source_version_id !== forkSourceId)
        return Response.json({ code: '42501' }, { status: 403 });
      const id = randomUUID(),
        specification = structuredClone(capturedAgent);
      specification.identity = {
        ...specification.identity,
        name: body.requested_name,
        slug: body.requested_slug,
      };
      specification.version = '0.1.0';
      specification.license = forkLicense;
      resources.set(id, {
        specification,
        sourceVersionId: forkSourceId,
        revision: 1,
        updatedAt: new Date().toISOString(),
      });
      if (failForkAck) return Response.json({ code: 'XX000' }, { status: 503 });
      return Response.json({
        resourceId: id,
        sourceVersionId: forkSourceId,
        slug: body.requested_slug,
        created: true,
      });
    }
    if (
      ['agentgrid_staff_reports', 'agentgrid_staff_report', 'agentgrid_decide_report'].some(
        (name) => url.pathname.endsWith('/' + name),
      )
    ) {
      if (!syntheticStaff) return Response.json({ code: '42501' }, { status: 403 });
      if (url.pathname.endsWith('/agentgrid_staff_reports'))
        return Response.json(
          [...staffReports.values()]
            .filter((row) => row.state === body.requested_state)
            .slice(body.requested_offset, body.requested_offset + 21)
            .map(({ id, targetKind, category, state, createdAt }) => ({
              id,
              targetKind,
              category,
              state,
              createdAt,
            })),
        );
      const row = staffReports.get(body.report_resource_id);
      if (url.pathname.endsWith('/agentgrid_staff_report')) return Response.json(row ?? null);
      if (!row || row.conflictOfInterest) return Response.json({ code: '42501' }, { status: 403 });
      if (row.state !== 'open') return Response.json({ code: '40001' }, { status: 409 });
      row.state = body.decision;
      row.resolution = body.explanation;
      row.resolvedAt = new Date().toISOString();
      return Response.json(failStaffReportAck ? null : row);
    }
    if (
      ['agentgrid_staff_reviews', 'agentgrid_staff_review', 'agentgrid_decide_review'].some(
        (name) => url.pathname.endsWith('/' + name),
      )
    ) {
      if (!syntheticStaff) return Response.json({ code: '42501' }, { status: 403 });
      if (url.pathname.endsWith('/agentgrid_staff_reviews'))
        return Response.json(
          [...staffReviews.values()]
            .filter((row) => row.state === body.requested_state)
            .slice(body.requested_offset, body.requested_offset + 21)
            .map(
              ({
                id,
                resourceId,
                resourceSlug,
                title,
                state,
                revision,
                decisionRevision,
                createdAt,
              }) => ({
                id,
                resourceId,
                resourceSlug,
                title,
                state,
                revision,
                decisionRevision,
                createdAt,
              }),
            ),
        );
      const row = staffReviews.get(body.review_resource_id);
      if (url.pathname.endsWith('/agentgrid_staff_review')) return Response.json(row ?? null);
      if (
        !row ||
        row.authorIsSelf ||
        row.state === 'withdrawn' ||
        (body.decision === 'published' && (!row.authorActive || !row.resourceAvailable))
      )
        return Response.json({ code: '42501' }, { status: 403 });
      if (
        row.revision !== body.expected_revision ||
        row.decisionRevision !== body.expected_decision_revision
      )
        return Response.json({ code: '40001' }, { status: 409 });
      row.state = body.decision;
      row.reason = body.explanation;
      row.decisionRevision++;
      row.reviewedAt = new Date().toISOString();
      return Response.json(failStaffAck ? null : row);
    }
    if (url.pathname.endsWith('/agentgrid_review_context')) {
      const available = body.resource_id === reviewTarget && !reviewBlocked;
      return Response.json({
        resourceId: body.resource_id,
        review: body.resource_id === reviewTarget ? ownReview : null,
        available,
        canReview: available && !reviewOwnSource,
        currentVersion: available ? reviewVersion : null,
      });
    }
    if (url.pathname.endsWith('/agentgrid_owned_review')) {
      if (reviewAcknowledgementUnavailable)
        return Response.json({ code: 'XX000' }, { status: 503 });
      return Response.json(body.resource_id === reviewTarget ? ownReview : null);
    }
    if (url.pathname.endsWith('/agentgrid_write_review')) {
      if (
        body.resource_id !== reviewTarget ||
        reviewBlocked ||
        reviewOwnSource ||
        ![reviewVersion.id, ownReview?.usedVersionId].includes(body.used_version)
      )
        return Response.json({ code: '42501' }, { status: 403 });
      if (body.expected_revision !== (ownReview?.revision ?? 0))
        return Response.json({ code: '40001' }, { status: 409 });
      ownReview = {
        id: ownReview?.id ?? randomUUID(),
        resourceId: reviewTarget,
        usedVersionId: body.used_version,
        version: body.used_version === reviewVersion.id ? reviewVersion.version : ownReview.version,
        rating: body.requested_rating,
        title: body.requested_title,
        body: body.requested_body,
        experience: body.experience,
        revision: (ownReview?.revision ?? 0) + 1,
        createdAt: ownReview?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        state: 'pending',
        reason: '',
        reviewedAt: null,
        withdrawnAt: null,
      };
      return Response.json(ownReview.id);
    }
    if (url.pathname.endsWith('/agentgrid_withdraw_review')) {
      if (body.resource_id !== reviewTarget || !ownReview)
        return Response.json({ code: '42501' }, { status: 403 });
      if (body.expected_revision !== ownReview.revision || ownReview.state === 'withdrawn')
        return Response.json({ code: '40001' }, { status: 409 });
      ownReview = {
        ...ownReview,
        state: 'withdrawn',
        withdrawnAt: new Date().toISOString(),
        reason: '',
        reviewedAt: null,
        updatedAt: new Date().toISOString(),
        revision: ownReview.revision + 1,
      };
      return Response.json(ownReview.id);
    }
    const agent = (id, record) => ({
      id,
      slug: record.specification.identity.slug,
      status: 'active',
      forked_from_version_id: record.sourceVersionId ?? null,
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
  const community = publicCommunityHandler(
    configuration.origin,
    publicReviewData(configuration, publicTransport),
  );
  const workspace = workspaceHandler(runtime, (session) =>
    workspaceData(configuration, session, transport),
  );
  const moderation = moderationHandler(
    runtime,
    (session) => workspaceData(configuration, session, transport).moderation,
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
                tools.innerHTML='<p>Synthetic community acceptance — disposable memory-only state. Sign in with owner@example.test and code 12345678; no real email is sent.</p><button data-qa-action="compete">Simulate competing revision</button><button data-qa-action="suspend">Suspend synthetic member</button><button data-qa-action="resume">Resume synthetic member</button><button data-qa-action="revoke">Revoke synthetic session</button><button data-qa-action="close-submissions">Close synthetic submissions</button><button data-qa-action="open-submissions">Open synthetic submissions</button><button data-qa-action="resolve-report">Resolve first synthetic report</button><button data-qa-action="fail-report-ack">Fail synthetic report acknowledgement</button><button data-qa-action="restore-report-ack">Restore synthetic report acknowledgement</button><button data-qa-action="publish-review">Approve synthetic review</button><button data-qa-action="hide-review">Hide synthetic review</button><button data-qa-action="fail-review-ack">Fail synthetic review acknowledgement</button><button data-qa-action="restore-review-ack">Restore synthetic review acknowledgement</button><button data-qa-action="block-review-source">Block synthetic review source</button><button data-qa-action="restore-review-source">Restore synthetic review source</button><button data-qa-action="own-review-source">Make synthetic review source own</button><button data-qa-action="other-review-source">Make synthetic review source another creator</button><button data-qa-action="advance-review-source">Advance synthetic release</button><button data-qa-action="compete-review">Simulate competing review edit</button><button data-qa-action="page-reviews">Add synthetic review pagination fixtures</button><button data-qa-action="clear-page-reviews">Remove synthetic review pagination fixtures</button><button data-qa-action="staff-on">Appoint synthetic moderator</button><button data-qa-action="staff-off">Revoke synthetic moderator</button><button data-qa-action="staff-fixtures">Create synthetic staff review queue</button><button data-qa-action="staff-compete">Simulate competing staff decision</button><button data-qa-action="staff-fail-ack">Fail synthetic staff acknowledgement</button><button data-qa-action="staff-restore-ack">Restore synthetic staff acknowledgement</button><button data-qa-action="staff-own">Make first staff review self-authored</button><button data-qa-action="staff-withdraw">Withdraw first staff review</button><button data-qa-action="staff-report-fixtures">Create synthetic staff report queue</button><button data-qa-action="staff-report-compete">Simulate competing report closure</button><button data-qa-action="staff-report-fail-ack">Fail synthetic resolution acknowledgement</button><button data-qa-action="staff-report-restore-ack">Restore synthetic resolution acknowledgement</button><button data-qa-action="staff-report-own">Mark first report as involved</button><button data-qa-action="staff-report-legacy">Remove first report captured context</button><a href="/workspace/fork/?sourceVersionId=70000000-0000-4000-8000-000000000001">Open synthetic fork source</a><button data-qa-action="fork-block">Block synthetic fork source</button><button data-qa-action="fork-restore">Restore synthetic fork source</button><button data-qa-action="fork-fail-ack">Fail synthetic fork acknowledgement</button><button data-qa-action="fork-restore-ack">Restore synthetic fork acknowledgement</button><p data-qa-status role="status"></p>';
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
          if (action === 'staff-report-fixtures') {
            staffReports.clear();
            for (let i = 1; i <= 23; i++) {
              const id = '60000000-0000-4000-8000-' + String(i).padStart(12, '0');
              const targetKind = ['agent', 'review', 'profile'][(i - 1) % 3];
              const snapshot =
                targetKind === 'agent'
                  ? {
                      kind: 'agent',
                      slug: capturedAgent.identity.slug,
                      versionId: reviewVersion.id,
                      version: capturedAgent.version,
                      specification: capturedAgent,
                    }
                  : targetKind === 'review'
                    ? {
                        kind: 'review',
                        resourceId: reviewTarget,
                        resourceSlug: 'synthetic-meal-planning',
                        usedVersionId: reviewVersion.id,
                        version: reviewVersion.version,
                        revision: 1,
                        title: 'Synthetic reported review <script>plain text</script>',
                        body: 'Synthetic captured review used for private moderation acceptance only. This untrusted text is not executed and claims no actual community activity.',
                        experience: 'Synthetic local captured use context for a reported review.',
                        rating: 4,
                      }
                    : {
                        kind: 'profile',
                        username: 'synthetic_reported_creator',
                        displayName: 'Synthetic reported creator',
                        bio: 'Synthetic captured creator biography only.',
                        website: 'https://example.test/creator',
                      };
              staffReports.set(id, {
                id,
                targetKind,
                targetId: reviewTarget,
                category: 'privacy',
                explanation:
                  'Synthetic confidential concern for staff acceptance only. Please investigate the captured content and provide a clear response.',
                state: 'open',
                resolution: '',
                resolvedAt: null,
                createdAt: '2026-10-07T00:00:00Z',
                conflictOfInterest: false,
                context: { capturedAt: '2026-10-07T00:00:00Z', snapshot },
              });
            }
          } else if (action === 'staff-report-fail-ack') failStaffReportAck = true;
          else if (action === 'staff-report-restore-ack') failStaffReportAck = false;
          else if (
            ['staff-report-compete', 'staff-report-own', 'staff-report-legacy'].includes(action)
          ) {
            const row = staffReports.values().next().value;
            if (!row) throw new Error('No staff report fixture');
            if (action === 'staff-report-own') row.conflictOfInterest = true;
            else if (action === 'staff-report-legacy') row.context = null;
            else {
              row.state = 'dismissed';
              row.resolution =
                'Another synthetic moderator closed this report during local acceptance.';
              row.resolvedAt = new Date().toISOString();
            }
          } else if (action === 'staff-on') syntheticStaff = true;
          else if (action === 'staff-off') syntheticStaff = false;
          else if (action === 'staff-fail-ack') failStaffAck = true;
          else if (action === 'staff-restore-ack') failStaffAck = false;
          else if (action === 'staff-fixtures') {
            staffReviews.clear();
            for (let i = 1; i <= 23; i++) {
              const id = '50000000-0000-4000-8000-' + String(i).padStart(12, '0');
              staffReviews.set(id, {
                id,
                resourceId: reviewTarget,
                resourceSlug: 'synthetic-meal-planning',
                title: 'Synthetic staff review ' + i,
                revision: 1,
                decisionRevision: 0,
                createdAt: '2026-10-07T00:00:00Z',
                updatedAt: '2026-10-07T00:00:00Z',
                state: 'pending',
                resourceAvailable: true,
                authorActive: true,
                authorIsSelf: false,
                usedVersionId: reviewVersion.id,
                version: reviewVersion.version,
                rating: 4,
                body: 'Synthetic feedback for local moderation acceptance only. The sample planning steps were clear, but the schedule needed a manual check. This is not real community activity.',
                experience:
                  'Synthetic local fixture using a redacted planning example. No real usage or community activity is claimed.',
                reason: '',
                reviewedAt: null,
                withdrawnAt: null,
              });
            }
          } else if (['staff-compete', 'staff-own', 'staff-withdraw'].includes(action)) {
            const row = staffReviews.values().next().value;
            if (!row) throw new Error('Missing staff fixture');
            if (action === 'staff-own') row.authorIsSelf = true;
            else if (action === 'staff-withdraw') {
              row.state = 'withdrawn';
              row.withdrawnAt = new Date().toISOString();
              row.revision++;
            } else {
              row.decisionRevision++;
              row.state = 'hidden';
              row.reason = 'Another synthetic moderator made this decision during local testing.';
              row.reviewedAt = new Date().toISOString();
            }
          } else if (action === 'publish-review' || action === 'hide-review') {
            if (!ownReview || ownReview.state === 'withdrawn')
              throw new Error('Author withdrawal is protected');
            ownReview = {
              ...ownReview,
              state: action === 'publish-review' ? 'published' : 'hidden',
              reason:
                'Synthetic moderation decision for local acceptance only; no real community activity.',
              reviewedAt: new Date().toISOString(),
            };
          } else if (action === 'fail-review-ack') reviewAcknowledgementUnavailable = true;
          else if (action === 'restore-review-ack') reviewAcknowledgementUnavailable = false;
          else if (action === 'block-review-source') reviewBlocked = true;
          else if (action === 'restore-review-source') reviewBlocked = false;
          else if (action === 'own-review-source') reviewOwnSource = true;
          else if (action === 'other-review-source') reviewOwnSource = false;
          else if (action === 'advance-review-source')
            reviewVersion = { id: '00000000-0000-4000-8000-000000000003', version: '1.0.1' };
          else if (action === 'compete-review') {
            if (!ownReview) throw new Error('No synthetic saved review');
            ownReview = {
              ...ownReview,
              revision: ownReview.revision + 1,
              title: 'Competing synthetic saved revision',
              updatedAt: new Date().toISOString(),
              state: 'pending',
              reason: '',
              reviewedAt: null,
              withdrawnAt: null,
            };
          } else if (action === 'page-reviews')
            pagingReviews = Array.from({ length: 23 }, (_, index) => ({
              id: '40000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
              usedVersionId: reviewVersion.id,
              version: reviewVersion.version,
              rating: 4,
              title: 'Synthetic pagination fixture ' + (index + 1),
              body: 'Clearly synthetic pagination feedback for local acceptance only. This does not represent any real use, review, creator or public activity.',
              experience:
                'Synthetic loopback pagination context only; not real community activity.',
              createdAt: '2026-10-07T00:00:00Z',
              updatedAt: '2026-10-07T00:00:00Z',
              author: { name: 'Community member', username: null },
            }));
          else if (action === 'clear-page-reviews') pagingReviews = [];
          else if (action === 'fork-block') forkSourceBlocked = true;
          else if (action === 'fork-restore') forkSourceBlocked = false;
          else if (action === 'fork-fail-ack') failForkAck = true;
          else if (action === 'fork-restore-ack') failForkAck = false;
          else if (action === 'compete') resources.get(resourceId).revision++;
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
        const response = incoming.url.startsWith('/api/community/')
          ? await community(request)
          : incoming.url.startsWith('/api/moderation/')
            ? await moderation(request)
            : incoming.url.startsWith('/api/workspace/')
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
