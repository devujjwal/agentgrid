import { z } from 'zod';

export const ReelPlanSchema = z
  .strictObject({
    sourceRunId: z.uuid(),
    title: z.string().trim().min(1).max(120),
    narration: z.string().trim().min(1).max(3000),
    scenes: z
      .array(
        z.strictObject({
          seconds: z.int().min(1).max(10),
          visual: z.string().trim().min(1).max(1000),
          onScreenText: z.string().max(200),
        }),
      )
      .min(1)
      .max(6),
    format: z.literal('portrait-720p'),
  })
  .refine(
    (plan) => plan.scenes.reduce((n, scene) => n + scene.seconds, 0) <= 30,
    'The pilot supports at most 30 seconds.',
  );
export type ReelPlan = z.infer<typeof ReelPlanSchema>;
export const MediaAssetSchema = z
  .strictObject({
    id: z.uuid(),
    ownerId: z.uuid(),
    runId: z.uuid(),
    key: z.string().max(200),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.int().min(12).max(50_000_000),
    contentType: z.literal('video/mp4'),
    width: z.literal(720),
    height: z.literal(1280),
    seconds: z.number().positive().max(30),
  })
  .refine(
    (asset) => asset.key === `owners/${asset.ownerId}/reels/${asset.runId}/${asset.id}.mp4`,
    'Media keys must be bound to their owner and run.',
  );
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
