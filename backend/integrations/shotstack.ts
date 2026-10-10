import { z } from 'zod';
import { ReelPlanSchema, type ReelPlan, type ReelProvider } from '../execution/reel-contracts.ts';
import {
  persistPrivateVideo,
  type PrivateMediaBucket,
  type VideoProbe,
} from '../execution/media.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import { approvedUrl, boundedBytes, providerJson, requireEnabled } from './http.ts';

/** All rates must come from an operator-reviewed, versioned price ceiling, never a client. */
export interface RenderRates {
  revision: string;
  imageMicros: number;
  speechCharacterMicros: number;
  renderSecondMicros: number;
}
export function shotstackTimeline(evidence: unknown) {
  const plan = ReelPlanSchema.parse(evidence);
  const seconds = plan.scenes.reduce((sum, scene) => sum + scene.seconds, 0);
  if (plan.narration.split(/\s+/u).length > seconds * 2)
    throw new Error('Narration is too long for this reel.');
  let start = 0;
  const clips = plan.scenes.map((scene) => {
    const timing = { start, length: scene.seconds };
    start += scene.seconds;
    return { timing, scene };
  });
  return {
    timeline: {
      background: '#000000',
      tracks: [
        {
          clips: clips
            .filter((c) => c.scene.onScreenText)
            .map(({ timing, scene }) => ({
              ...timing,
              position: 'center',
              asset: {
                type: 'rich-text',
                text: scene.onScreenText,
                font: { family: 'Open Sans', size: 48, weight: '700', color: '#ffffff' },
                background: { color: '#000000', opacity: 0.65, padding: 12 },
                align: { horizontal: 'center', vertical: 'middle' },
              },
            })),
        },
        {
          clips: clips.map(({ timing, scene }) => ({
            ...timing,
            asset: {
              type: 'image',
              prompt: scene.visual,
              model: 'nano-banana-2',
              options: { resolution: '1K', aspectRatio: '9:16' },
            },
            fit: 'cover',
          })),
        },
        {
          clips: [
            {
              start: 0,
              length: seconds,
              asset: {
                type: 'audio',
                prompt: plan.narration,
                model: 'polly-neural',
                options: { voice: 'Matthew', language: 'en-US' },
                volume: 1,
              },
            },
          ],
        },
      ],
    },
    output: { format: 'mp4', size: { width: 720, height: 1280 }, fps: 30 },
  };
}
export function shotstackProvider(options: {
  enabled: () => boolean;
  transport: typeof fetch;
  apiKey: () => Promise<string>;
  rates: RenderRates;
  outputHosts: readonly string[];
  bucket: PrivateMediaBucket;
  probe: VideoProbe;
  /** Resolve a known task from the private ledger. No task IDs or owners from HTTP input. */
  context: (
    taskId: string,
  ) => Promise<{ ownerId: string; runId: string; maximumCostMicros: number } | null>;
  /** Independent billing evidence; absence keeps the run pending and its reservation held. */
  billedCost: (taskId: string) => Promise<number | null>;
}): ReelProvider {
  const rates = z
    .strictObject({
      revision: z.string().regex(/^[a-zA-Z0-9.-]{1,32}$/),
      imageMicros: z.number().int().positive(),
      speechCharacterMicros: z.number().int().positive(),
      renderSecondMicros: z.number().int().positive(),
    })
    .parse(options.rates);
  const base = 'https://api.shotstack.io/edit/v1/render';
  async function request(url: string, signal: AbortSignal, body?: unknown) {
    requireEnabled(options.enabled);
    const key = await options.apiKey();
    if (!key || key.length > 8000) throw new Error('Renderer unavailable.');
    return providerJson(options.transport, url, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }
  return {
    identity: `shotstack-v1.nano-banana-2.polly-neural.${rates.revision}`,
    estimate(plan: ReelPlan) {
      shotstackTimeline(plan);
      const total =
        plan.scenes.length * rates.imageMicros +
        plan.narration.length * rates.speechCharacterMicros +
        plan.scenes.reduce((n, s) => n + s.seconds, 0) * rates.renderSecondMicros;
      if (!Number.isSafeInteger(total) || total > 5_000_000)
        throw new Error('Renderer quote exceeds pilot limit.');
      return total;
    },
    async submit(plan, runId, signal) {
      z.uuid().parse(runId);
      const result = await request(base, signal, shotstackTimeline(plan));
      const parsed = z
        .object({ success: z.literal(true), response: z.object({ id: z.uuid() }) })
        .parse(result.body);
      return { taskId: parsed.response.id };
    },
    async inspect(taskId, signal) {
      requireEnabled(options.enabled);
      z.uuid().parse(taskId);
      const context = await options.context(taskId);
      if (!context) throw new Error('Renderer task unavailable.');
      const result = await request(`${base}/${taskId}`, signal);
      const parsed = z
        .object({
          success: z.literal(true),
          response: z.object({
            id: z.literal(taskId),
            status: z.string(),
            url: z.string().optional(),
          }),
        })
        .parse(result.body).response;
      if (parsed.status === 'failed') return { state: 'failed' };
      if (parsed.status !== 'done') return { state: 'pending' };
      const billedMicros = await options.billedCost(taskId);
      if (billedMicros === null) return { state: 'pending' };
      if (
        !Number.isSafeInteger(billedMicros) ||
        billedMicros < 0 ||
        billedMicros > context.maximumCostMicros ||
        !parsed.url
      )
        throw new Error('Renderer evidence unavailable.');
      const url = approvedUrl(parsed.url, options.outputHosts);
      requireEnabled(options.enabled);
      const response = await providerFetch(options.transport, url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      });
      const bytes = await boundedBytes(response, 50_000_000);
      const asset = await persistPrivateVideo({
        ...context,
        bytes,
        bucket: options.bucket,
        probe: options.probe,
      });
      return { state: 'succeeded', asset, billedMicros };
    },
  };
}
