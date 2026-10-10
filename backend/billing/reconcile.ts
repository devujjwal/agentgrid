import { z } from 'zod';
import { boundedBytes, providerJson, sha256 } from '../integrations/http.ts';

/** An operator attestation of an actual, task-specific USD debit, never a quote.
 * Stored only in a separate private bucket that the execution Worker cannot write.
 */
export const BillingReceiptSchema = z.strictObject({
  version: z.literal(1),
  provider: z.literal('shotstack-production'),
  taskId: z.uuid(),
  providerOwner: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  currency: z.literal('USD'),
  credits: z.number().finite().nonnegative().max(1_000_000),
  actualDebitMicros: z.number().int().nonnegative().safe().max(5_000_000),
  evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewedBy: z.uuid(),
  reviewedAt: z.iso.datetime(),
  basis: z.literal('task-specific-provider-debit'),
  settled: z.literal(true),
});
export interface BillingBucket {
  get(key: string): Promise<{ size: number; body: ReadableStream<Uint8Array> } | null>;
}
export async function verifiedRenderCost(
  taskId: string,
  options: {
    enabled: () => boolean;
    bucket: BillingBucket | undefined;
    providerOwner: unknown;
    apiKey: unknown;
    transport: typeof fetch;
    now?: () => Date;
  },
): Promise<number | null> {
  // Disabled operation performs no storage access, provider request or secret lookup.
  if (!options.enabled()) return null;
  try {
    z.uuid().parse(taskId);
    if (!options.bucket) return null;
    const object = await options.bucket.get(`receipts/${taskId}.json`);
    if (!object || object.size > 16_384) return null;
    const bytes = await boundedBytes(new Response(object.body), 16_384);
    const receipt = BillingReceiptSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    if (
      receipt.taskId !== taskId ||
      receipt.providerOwner !== options.providerOwner ||
      Date.parse(receipt.reviewedAt) > (options.now?.() ?? new Date()).getTime()
    )
      return null;
    const evidence = await options.bucket.get(`evidence/${receipt.evidenceSha256}`);
    if (!evidence || evidence.size > 2_000_000) return null;
    const evidenceBytes = await boundedBytes(new Response(evidence.body), 2_000_000);
    if (!evidenceBytes.length || (await sha256(evidenceBytes)) !== receipt.evidenceSha256)
      return null;
    const key = z.string().min(1).max(8000).parse(options.apiKey);
    if (!options.enabled()) return null;
    // Independently fetch current actual usage. No POST, quote or render is possible here.
    const result = await providerJson(
      options.transport,
      `https://api.shotstack.io/edit/v1/render/${taskId}`,
      {
        method: 'GET',
        headers: { 'x-api-key': key },
      },
    );
    const status = z
      .object({
        success: z.literal(true),
        response: z.object({
          id: z.literal(taskId),
          owner: z.literal(receipt.providerOwner),
          status: z.literal('done'),
          credits: z.literal(receipt.credits),
        }),
      })
      .safeParse(result.body);
    return status.success && options.enabled() ? receipt.actualDebitMicros : null;
  } catch {
    // Missing, mismatched or unavailable evidence always leaves reservations held.
    return null;
  }
}
