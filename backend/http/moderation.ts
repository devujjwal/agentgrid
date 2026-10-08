import { z } from 'zod';
import { RequestReleaseSchema, CancelReleaseSchema } from '../../src/domain/release-approval.ts';
import { RecordHostRunSchema } from '../../src/domain/host-verification.ts';
import { ResourceDecisionSchema } from '../../src/domain/resource-moderation.ts';
import { RejectSubmissionSchema } from '../../src/domain/submission-moderation.ts';
import { SubmissionStateSchema } from '../../src/domain/versions.ts';
import type { IdentityRuntime } from '../auth/runtime.ts';
import type { ProviderSession } from '../auth/contracts.ts';
import type { moderationResources } from '../workspace/moderation.ts';
import { assertCsrf } from '../auth/csrf.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import {
  ReportDecisionSchema,
  ReportQueueStateSchema,
} from '../../src/domain/report-moderation.ts';
import { ReviewDecisionSchema, ReviewQueueStateSchema } from '../../src/domain/moderation.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';

export function moderationHandler(
  runtime: IdentityRuntime,
  dataForSession: (session: ProviderSession) => ReturnType<typeof moderationResources>,
) {
  return async (request: Request): Promise<Response> => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url),
        path = url.pathname;
      if (
        ![
          '/api/moderation/release-requests/',
          '/api/moderation/release-request/',
          '/api/moderation/release-cancel/',
          '/api/moderation/host-record/',
          '/api/moderation/host-runs/',
          '/api/moderation/host-run/',
          '/api/moderation/resource/',
          '/api/moderation/resource-decision/',
          '/api/moderation/reviews/',
          '/api/moderation/review/',
          '/api/moderation/decision/',
          '/api/moderation/reports/',
          '/api/moderation/report/',
          '/api/moderation/resolution/',
          '/api/moderation/submissions/',
          '/api/moderation/submission/',
          '/api/moderation/rejection/',
        ].includes(path)
      )
        throw new HttpFailure(404, 'not-found');
      const mutation =
        path === '/api/moderation/release-request/' ||
        path === '/api/moderation/release-cancel/' ||
        path === '/api/moderation/host-run/' ||
        path === '/api/moderation/resource-decision/' ||
        path === '/api/moderation/decision/' ||
        path === '/api/moderation/resolution/' ||
        path === '/api/moderation/rejection/';
      if (mutation) {
        if (url.search) throw new HttpFailure(400, 'invalid-request');
        await assertCsrf(runtime, request);
      } else {
        if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
        if (
          request.headers.has('sec-fetch-site') &&
          request.headers.get('sec-fetch-site') !== 'same-origin'
        )
          throw new HttpFailure(403, 'request-refused');
      }
      const session = await authenticatedSession(runtime, request),
        data = dataForSession(session.provider);
      if (mutation) {
        if (path === '/api/moderation/release-request/') {
          const parsed = RequestReleaseSchema.safeParse(await readJsonBody(request, 14_000));
          if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
          return privateJson(await data.requestRelease(parsed.data));
        }
        if (path === '/api/moderation/release-cancel/') {
          const parsed = CancelReleaseSchema.safeParse(await readJsonBody(request, 1000));
          if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
          return privateJson(await data.cancelRelease(parsed.data.requestId));
        }
        if (path === '/api/moderation/host-run/') {
          const parsed = RecordHostRunSchema.safeParse(await readJsonBody(request, 100_000));
          if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
          return privateJson(await data.recordHostRun(parsed.data));
        }
        if (path === '/api/moderation/resource-decision/') {
          const parsed = ResourceDecisionSchema.safeParse(await readJsonBody(request, 12_000));
          if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
          return privateJson(await data.decideResource(parsed.data));
        }
        if (path === '/api/moderation/rejection/') {
          const parsed = RejectSubmissionSchema.safeParse(await readJsonBody(request, 12_000));
          if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
          return privateJson(await data.rejectSubmission(parsed.data));
        }
        if (path === '/api/moderation/resolution/') {
          const parsed = ReportDecisionSchema.safeParse(await readJsonBody(request, 12_000));
          if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
          return privateJson(await data.decideReport(parsed.data));
        }
        const parsed = ReviewDecisionSchema.safeParse(await readJsonBody(request, 12_000));
        if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.decideReview(parsed.data));
      }
      const allowed =
        path === '/api/moderation/host-record/'
          ? ['recordId']
          : path === '/api/moderation/resource/'
            ? ['resourceId']
            : path === '/api/moderation/submission/' ||
                path === '/api/moderation/host-runs/' ||
                path === '/api/moderation/release-requests/'
              ? ['versionId']
              : path === '/api/moderation/review/'
                ? ['reviewId']
                : path === '/api/moderation/report/'
                  ? ['reportId']
                  : ['state', 'offset'];
      if (
        [...url.searchParams.keys()].some(
          (key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1,
        )
      )
        throw new HttpFailure(400, 'invalid-request');
      if (path === '/api/moderation/host-record/') {
        const id = z.uuid().safeParse(url.searchParams.get('recordId'));
        if (!id.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.hostRun(id.data));
      }
      if (path === '/api/moderation/release-requests/') {
        const id = z.uuid().safeParse(url.searchParams.get('versionId'));
        if (!id.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.releaseApprovals(id.data));
      }
      if (path === '/api/moderation/host-runs/') {
        const id = z.uuid().safeParse(url.searchParams.get('versionId'));
        if (!id.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.hostRuns(id.data));
      }
      if (path === '/api/moderation/resource/') {
        const id = z.uuid().safeParse(url.searchParams.get('resourceId'));
        if (!id.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.staffResource(id.data));
      }
      if (path === '/api/moderation/submission/') {
        const id = z.uuid().safeParse(url.searchParams.get('versionId'));
        if (!id.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.staffSubmission(id.data));
      }
      if (path === '/api/moderation/submissions/') {
        const state = SubmissionStateSchema.safeParse(url.searchParams.get('state')),
          offset = url.searchParams.get('offset') ?? '0';
        if (!state.success || !/^\d{1,4}$/.test(offset))
          throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.submissionQueue(state.data, Number(offset)));
      }
      if (path === '/api/moderation/review/') {
        const id = z.uuid().safeParse(url.searchParams.get('reviewId'));
        if (!id.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.staffReview(id.data));
      }
      if (path === '/api/moderation/report/') {
        const id = z.uuid().safeParse(url.searchParams.get('reportId'));
        if (!id.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.staffReport(id.data));
      }
      if (path === '/api/moderation/reports/') {
        const state = ReportQueueStateSchema.safeParse(url.searchParams.get('state')),
          offset = url.searchParams.get('offset') ?? '0';
        if (!state.success || !/^\d{1,4}$/.test(offset))
          throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.reportQueue(state.data, Number(offset)));
      }
      const state = ReviewQueueStateSchema.safeParse(url.searchParams.get('state')),
        offset = url.searchParams.get('offset') ?? '0';
      if (!state.success || !/^\d{1,4}$/.test(offset))
        throw new HttpFailure(400, 'invalid-request');
      return privateJson(await data.reviewQueue(state.data, Number(offset)));
    } catch (error) {
      return privateFailure(error);
    }
  };
}
