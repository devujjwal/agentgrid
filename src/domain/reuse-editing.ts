import type { AgentSpecification } from './agent-specification';
type License = AgentSpecification['license'];

/** Guided editing removes dependent grants, never silently widens permissions. */
export function changeReusePermission(
  license: License,
  permission: keyof License['permissions'],
  granted: boolean,
): License {
  const permissions = { ...license.permissions, [permission]: granted };
  const scoped = license.public_fork_scope === 'agentgrid-only';
  if (!permissions.use || !permissions.modify || (!permissions.redistribute && !scoped))
    permissions.public_fork = false;
  const { public_fork_scope: previous, ...rest } = license;
  void previous;
  return {
    ...rest,
    permissions,
    ...(scoped && permissions.public_fork && !permissions.redistribute
      ? { public_fork_scope: 'agentgrid-only' as const }
      : {}),
  };
}

export function changeForkScope(license: License, scope: 'general' | 'agentgrid-only'): License {
  const { public_fork_scope: previous, ...rest } = license;
  void previous;
  if (scope === 'agentgrid-only')
    return {
      ...rest,
      public_fork_scope: scope,
      permissions: { use: true, modify: true, redistribute: false, public_fork: true },
    };
  return {
    ...rest,
    permissions: {
      ...license.permissions,
      public_fork:
        license.permissions.public_fork &&
        license.permissions.use &&
        license.permissions.modify &&
        license.permissions.redistribute,
    },
  };
}
