import { z } from 'zod';
import { ForkInputSchema } from '../../src/domain/forks.ts';
import type { IdentityRuntime } from '../auth/runtime.ts';
import type { ProviderSession } from '../auth/contracts.ts';
import { assertCsrf } from '../auth/csrf.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import type { WorkspaceData } from '../workspace/data.ts';
import { ProfileInputSchema, OnboardingInputSchema } from '../../src/domain/workspace.ts';
import { CreateDraftSchema, UpdateDraftSchema } from '../../src/domain/draft.ts';
import { SubmitVersionSchema, WithdrawVersionSchema } from '../../src/domain/versions.ts';
import { ReportInputSchema } from '../../src/domain/reports.ts';
import { ReviewInputSchema, WithdrawReviewSchema } from '../../src/domain/reviews.ts';
import { assertJsonDocumentBounds } from '../../src/domain/agent-specification.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';

async function input<T>(request: Request, schema: z.ZodType<T>, maximum = 10_000) {
  const value = await readJsonBody(request, maximum);
  try {
    assertJsonDocumentBounds(value);
  } catch {
    throw new HttpFailure(400, 'invalid-request');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
  return parsed.data;
}
export function workspaceHandler(
  runtime: IdentityRuntime,
  dataForSession: (session: ProviderSession) => WorkspaceData,
) {
  return async (request: Request): Promise<Response> => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url);
      const read =
        [
          '/api/workspace/',
          '/api/workspace/agents/',
          '/api/workspace/saved/',
          '/api/workspace/versions/',
          '/api/workspace/version/',
          '/api/workspace/reports/',
          '/api/workspace/reviewcontext/',
          '/api/workspace/forksource/',
        ].includes(url.pathname) ||
        (['/api/workspace/favorite/', '/api/workspace/draft/', '/api/workspace/review/'].includes(
          url.pathname,
        ) &&
          request.method === 'GET');
      const mutation =
        !read &&
        [
          '/api/workspace/onboard/',
          '/api/workspace/profile/',
          '/api/workspace/visibility/',
          '/api/workspace/favorite/',
          '/api/workspace/create/',
          '/api/workspace/fork/',
          '/api/workspace/draft/',
          '/api/workspace/submit/',
          '/api/workspace/withdraw/',
          '/api/workspace/report/',
          '/api/workspace/review/',
          '/api/workspace/reviewwithdraw/',
        ].includes(url.pathname);
      if (!read && !mutation) throw new HttpFailure(404, 'not-found');
      if (read && request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
      if (
        read &&
        request.headers.has('sec-fetch-site') &&
        request.headers.get('sec-fetch-site') !== 'same-origin'
      )
        throw new HttpFailure(403, 'request-refused');
      if (mutation) {
        if (url.search) throw new HttpFailure(400, 'invalid-request');
        await assertCsrf(runtime, request);
      }
      const session = await authenticatedSession(runtime, request);
      const data = dataForSession(session.provider);
      if (url.pathname === '/api/workspace/forksource/') {
        if (
          [...url.searchParams.keys()].some((key) => key !== 'sourceVersionId') ||
          url.searchParams.getAll('sourceVersionId').length !== 1
        )
          throw new HttpFailure(400, 'invalid-request');
        const source = z.uuid().safeParse(url.searchParams.get('sourceVersionId'));
        if (!source.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.forkSource(source.data));
      }
      if (url.pathname === '/api/workspace/fork/')
        return privateJson(await data.forkAgent(await input(request, ForkInputSchema)), 201);
      if (url.pathname === '/api/workspace/') {
        if (url.search) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.identity());
      }
      if (url.pathname === '/api/workspace/reports/') {
        if (
          [...url.searchParams.keys()].some((key) => key !== 'offset') ||
          url.searchParams.getAll('offset').length > 1
        )
          throw new HttpFailure(400, 'invalid-request');
        const offset = url.searchParams.get('offset') ?? '0';
        if (!/^\d{1,4}$/.test(offset)) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.reports(Number(offset)));
      }
      if (url.pathname === '/api/workspace/report/')
        return privateJson(await data.createReport(await input(request, ReportInputSchema)), 201);
      if (url.pathname === '/api/workspace/review/' && request.method === 'POST')
        return privateJson(
          await data.writeReview(await input(request, ReviewInputSchema, 24_000)),
          201,
        );
      if (url.pathname === '/api/workspace/reviewwithdraw/')
        return privateJson(await data.withdrawReview(await input(request, WithdrawReviewSchema)));
      if (url.pathname.endsWith('/versions/')) {
        if (
          [...url.searchParams.keys()].some((key) => !['resourceId', 'offset'].includes(key)) ||
          url.searchParams.getAll('resourceId').length !== 1 ||
          url.searchParams.getAll('offset').length > 1
        )
          throw new HttpFailure(400, 'invalid-request');
        const resource = z.uuid().safeParse(url.searchParams.get('resourceId'));
        const offset = url.searchParams.get('offset') ?? '0';
        if (!resource.success || !/^\d{1,4}$/.test(offset))
          throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.versions(resource.data, Number(offset)));
      }
      if (url.pathname.endsWith('/version/')) {
        if (
          [...url.searchParams.keys()].some((key) => !['resourceId', 'versionId'].includes(key)) ||
          url.searchParams.getAll('resourceId').length !== 1 ||
          url.searchParams.getAll('versionId').length !== 1
        )
          throw new HttpFailure(400, 'invalid-request');
        const resource = z.uuid().safeParse(url.searchParams.get('resourceId')),
          version = z.uuid().safeParse(url.searchParams.get('versionId'));
        if (!resource.success || !version.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.versionDocument(resource.data, version.data));
      }
      if (url.pathname.endsWith('/submit/')) {
        const value = await input(request, SubmitVersionSchema);
        return privateJson(await data.submitVersion(value.resourceId, value.expectedRevision), 201);
      }
      if (url.pathname.endsWith('/withdraw/')) {
        const value = await input(request, WithdrawVersionSchema);
        return privateJson(
          await data.withdrawVersion(value.resourceId, value.versionId, value.reason),
        );
      }
      if (
        [
          '/api/workspace/favorite/',
          '/api/workspace/draft/',
          '/api/workspace/review/',
          '/api/workspace/reviewcontext/',
        ].includes(url.pathname) &&
        request.method === 'GET'
      ) {
        if (
          [...url.searchParams.keys()].some((key) => key !== 'resourceId') ||
          url.searchParams.getAll('resourceId').length !== 1
        )
          throw new HttpFailure(400, 'invalid-request');
        const resource = z.uuid().safeParse(url.searchParams.get('resourceId'));
        if (!resource.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(
          url.pathname.endsWith('/reviewcontext/')
            ? await data.reviewContext(resource.data)
            : url.pathname.endsWith('/review/')
              ? await data.review(resource.data)
              : url.pathname.endsWith('/draft/')
                ? await data.draft(resource.data)
                : await data.saveState(resource.data),
        );
      }
      if (url.pathname.endsWith('/create/')) {
        const value = await input(request, CreateDraftSchema, 100_000);
        return privateJson(await data.createDraft(value.specification), 201);
      }
      if (url.pathname.endsWith('/draft/')) {
        const value = await input(request, UpdateDraftSchema, 100_000);
        return privateJson(
          await data.saveDraft(
            value.resourceId,
            value.expectedRevision,
            value.specification,
            value.editorial,
          ),
        );
      }
      if (url.pathname.endsWith('/agents/') || url.pathname.endsWith('/saved/')) {
        if (
          [...url.searchParams.keys()].some((key) => key !== 'offset') ||
          url.searchParams.getAll('offset').length > 1
        )
          throw new HttpFailure(400, 'invalid-request');
        const offset = url.searchParams.get('offset') ?? '0';
        if (!/^\d{1,4}$/.test(offset)) throw new HttpFailure(400, 'invalid-request');
        return privateJson(
          url.pathname.endsWith('/saved/')
            ? await data.saved(Number(offset))
            : await data.agents(Number(offset)),
        );
      }
      if (url.pathname.endsWith('/onboard/'))
        await data.onboard(await input(request, OnboardingInputSchema));
      else if (url.pathname.endsWith('/profile/'))
        await data.updateProfile(await input(request, ProfileInputSchema));
      else if (url.pathname.endsWith('/visibility/')) {
        const value = await input(request, z.strictObject({ public: z.boolean() }));
        await data.visibility(value.public);
      } else {
        const value = await input(
          request,
          z.strictObject({ resourceId: z.uuid(), saved: z.boolean() }),
        );
        return privateJson({ saved: await data.favorite(value.resourceId, value.saved) });
      }
      return privateJson({ updated: true });
    } catch (error) {
      return privateFailure(error);
    }
  };
}
