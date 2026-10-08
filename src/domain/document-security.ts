/** Framing cannot be enforced by a CSP meta element; send these on every document. */
export const documentHeaderPolicy =
  "base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
export const documentSecurityHeaders = {
  'content-security-policy': documentHeaderPolicy,
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
} as const;
