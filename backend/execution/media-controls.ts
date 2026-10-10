/** Exact opt-in at both layers. Import this when wiring future HTTP/Worker adapters.
 * Keeping the global execution flag off disables video and social dispatch too.
 */
export function mediaCapabilities(environment: Record<string, unknown>) {
  const execution = environment.AGENTGRID_EXECUTION_ENABLED === '1';
  return {
    connect: execution && environment.AGENTGRID_SOCIAL_OAUTH_ENABLED === '1',
    render: execution && environment.AGENTGRID_REEL_GENERATION_ENABLED === '1',
    publish: execution && environment.AGENTGRID_SOCIAL_PUBLISHING_ENABLED === '1',
  };
}
