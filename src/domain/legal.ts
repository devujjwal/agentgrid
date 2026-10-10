/** Public operator identity. AgentGrid is a product, not a registered company. */
export const legalOperator = Object.freeze({
  name: 'Ujjwal Paul',
  country: 'India',
  capacity: 'individual',
  brand: 'AgentGrid',
  email: 'contact@agentgrid.me',
  contactHref: 'mailto:contact@agentgrid.me',
});
export const legalDocuments = Object.freeze({
  termsVersion: '2026-10-09',
  privacyVersion: '2026-10-10',
  firstPartyLicenseVersion: '1.0',
  firstPartyLicensePath: '/licenses/agentgrid-internal-use-v1/',
});

/** Versioned grant for first-party packages only; never a community default. */
export const firstPartyPackageLicense = {
  identifier: 'custom' as const,
  statement:
    'AgentGrid Internal Use and Hosted Fork License 1.0, by Ujjwal Paul (AgentGrid Editorial). You may use these instructions for your own personal and commercial workflows, copy them into supported AI platforms and adapt them for internal use. You may publish attributed forks within AgentGrid under these same terms, preserving source, version and lineage. No general right to republish elsewhere, redistribute, resell, sublicense, scrape into competing datasets or directories, or commercially reproduce the package library is granted. Keep this notice with instruction copies and forks. Workflow outputs are not restricted by this package license; third-party and platform terms still apply. See the versioned license for full terms.',
  url: 'https://agentgrid.me/licenses/agentgrid-internal-use-v1/',
  public_fork_scope: 'agentgrid-only' as const,
  permissions: { use: true, modify: true, redistribute: false, public_fork: true },
};
