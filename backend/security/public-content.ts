/** Conservative release-time checks; never include matched credential text in errors. */
const CREDENTIAL_SIGNATURES = [
  /\b(?:sb_secret_|sbp_|GOCSPX-|cfat_|ghp_|gho_|ghu_|ghs_|github_pat_)[A-Za-z0-9_-]{16,}/,
  /\bre_[A-Za-z0-9_-]{24,}/,
  /\bsk-(?:proj-|ant-api\d+-)?[A-Za-z0-9_-]{24,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/,
];

export function hasCredentialSignature(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return CREDENTIAL_SIGNATURES.some((pattern) => pattern.test(serialized));
}
