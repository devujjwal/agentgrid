/** Workers supports manual redirects but rejects redirect: 'error'. Keep the
 * security guarantee explicitly: never follow a provider redirect or forward
 * credentials to its destination. Discard the body and expose no Location. */
export async function providerFetch(
  transport: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
): Promise<Response> {
  const response = await transport(input, { ...init, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new Error('Provider redirect refused.');
  }
  return response;
}
