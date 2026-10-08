import delivery from '../../content/publication/delivery.json';
import { DeliveryManifestSchema } from '../../src/domain/publication-snapshot.ts';
import { deliveryGuard } from '../../backend/publication/delivery.ts';
import { publicPublicationSource } from '../../backend/publication/source.ts';
interface Context {
  request: Request;
  env: Record<string, unknown> & { ASSETS: { fetch: typeof fetch } };
}
export async function onRequest(context: Context) {
  const guarded = deliveryGuard(DeliveryManifestSchema.parse(delivery), async (slug) => {
    const rpc = publicPublicationSource({
      origin: context.env.NEXT_PUBLIC_SUPABASE_URL,
      key: context.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
    return rpc('agentgrid_public_delivery_state', { resource_slug: slug });
  });
  return guarded(context.request, async () => {
    const headers = new Headers(context.request.headers);
    for (const name of ['if-none-match', 'if-modified-since', 'if-range', 'range'])
      headers.delete(name);
    return context.env.ASSETS.fetch(new Request(context.request, { headers }));
  });
}
