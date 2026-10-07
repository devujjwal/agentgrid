import type { AuthConfiguration } from './configuration.ts';
import type { IdentityStore, ManagedIdentity } from './contracts.ts';
import { createEnvelopeCodec } from '../security/envelope.ts';
import { createPrivateMac } from '../security/mac.ts';

export async function identityRuntime(
  configuration: AuthConfiguration,
  store: IdentityStore,
  managed: ManagedIdentity,
  now = () => Math.floor(Date.now() / 1000),
) {
  const [codec, mac] = await Promise.all([
    createEnvelopeCodec(configuration.envelopeKeys, configuration.origin),
    createPrivateMac(configuration.rateKey, configuration.origin),
  ]);
  return { configuration, store, managed, codec, mac, now };
}
export type IdentityRuntime = Awaited<ReturnType<typeof identityRuntime>>;
