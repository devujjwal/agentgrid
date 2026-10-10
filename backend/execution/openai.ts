import { z } from 'zod';
import { providerFetch } from '../http/provider-fetch.ts';
import type { TextProvider } from './contracts.ts';

export const runtimeModel = 'gpt-4.1-mini-2025-04-14';
export const runtimeProviderIdentity = 'openai/' + runtimeModel + '/2026-10-10';
// Standard uncached prices verified 2026-10-10; activation requires rechecking
// these rates. No tools, audio, files or additional paid services are sent.
const inputMicrosPerToken = 0.4,
  outputMicrosPerToken = 1.6;
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
export function estimateTextCost(instructions: string, input: string): number {
  // UTF-8 bytes upper-bound text token count, with allowance for message framing.
  return Math.ceil(
    (bytes(instructions) + bytes(input) + 2048) * inputMicrosPerToken + 2048 * outputMicrosPerToken,
  );
}
const ResponseSchema = z.object({
  model: z.literal(runtimeModel),
  status: z.literal('completed'),
  usage: z.object({
    input_tokens: z.int().nonnegative(),
    output_tokens: z.int().nonnegative().max(2048),
  }),
  output: z.array(
    z.object({
      type: z.string(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    }),
  ),
});
export function openaiTextProvider(apiKey: string, transport: typeof fetch = fetch): TextProvider {
  if (!apiKey || apiKey.length > 512) throw new Error('Execution provider unavailable.');
  return {
    identity: runtimeProviderIdentity,
    estimate: estimateTextCost,
    async generate(request) {
      const response = await providerFetch(transport, 'https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          model: runtimeModel,
          instructions: request.instructions,
          input: request.input,
          max_output_tokens: request.maxOutputTokens,
          store: false,
          tools: [],
          tool_choice: 'none',
          truncation: 'disabled',
        }),
      });
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error('Execution provider unavailable.');
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          total += chunk.value.byteLength;
          if (total > 200_000) {
            await reader.cancel();
            throw new Error('Execution response exceeds bounds.');
          }
          chunks.push(chunk.value);
        }
      } finally {
        reader.releaseLock();
      }
      const body = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const value = ResponseSchema.parse(
        JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)),
      );
      if (value.usage.input_tokens > bytes(request.instructions) + bytes(request.input) + 2048)
        throw new Error('Execution usage exceeds bounds.');
      if (value.output.some((item) => item.type !== 'message'))
        throw new Error('Unsupported execution output.');
      const text = value.output
        .flatMap((item) => item.content ?? [])
        .filter((item) => item.type === 'output_text')
        .map((item) => item.text ?? '')
        .join('\n');
      return {
        text,
        billedMicros: Math.ceil(
          value.usage.input_tokens * inputMicrosPerToken +
            value.usage.output_tokens * outputMicrosPerToken,
        ),
      };
    },
  };
}
