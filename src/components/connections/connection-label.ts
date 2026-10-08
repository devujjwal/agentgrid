import type { ConnectionKind } from '../../domain/connection-guide';
export const connectionLabel = (kind: ConnectionKind) =>
  kind === 'platform' ? 'Platforms' : kind === 'integration' ? 'Integrations' : 'MCP';
