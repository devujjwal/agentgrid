#!/usr/bin/env python3
"""Read-only post-rollout checks; no real users or application fixtures are created."""
import importlib.util
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("agentgrid_shared_audit", ROOT / "scripts/inspect-shared-supabase.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def main():
    result = subprocess.run([sys.executable, str(ROOT / "scripts/apply-shared-agentgrid-migrations.py")],
                            cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Shared schema/history prerequisite failed")
    token = audit.load_token()
    for role in ("anon", "authenticated"):
        # Claims are synthetic, nonexistent and transaction-local. PostgreSQL
        # read-only protects against accidental writes even though SET ROLE needs
        # the management API's unrestricted query mode.
        statement = f"""begin read only;
set local role {role};
set local request.jwt.claims='{{"sub":"99883173-58f3-4d6a-96a5-0f116c981d21","role":"{role}"}}';
select jsonb_build_object(
 'resource_visible',(select count(*) from public.agentgrid_public_resource('agentgrid-nonexistent-boundary-fixture')),
 'creator_visible',(select count(*) from public.agentgrid_public_creator('agentgrid-nonexistent-boundary-fixture')),
 'identity_access',has_table_privilege(current_user,'public.agentgrid_identities','SELECT'),
 'publication_access',has_function_privilege(current_user,'public.agentgrid_publish_version(uuid,uuid,text,jsonb)','EXECUTE')
) as boundary;
commit;"""
        boundary = audit.request("/database/query", token, {"query": statement, "read_only": False})[0]["boundary"]
        if any(boundary.values()):
            raise RuntimeError("AgentGrid anonymous/non-member read boundary failed")
        if role == "authenticated":
            statement = """begin read only; set local role authenticated;
set local request.jwt.claims='{"sub":"99883173-58f3-4d6a-96a5-0f116c981d21","role":"authenticated"}';
select public.agentgrid_profile_id() as profile_id, public.agentgrid_is_member() as member,
 (select count(*) from public.agentgrid_profiles) as private_profiles,
 (select count(*) from public.agentgrid_user_roles) as staff_roles,
 (select count(*) from public.agentgrid_favorites) as private_saves;
commit;"""
            boundary = audit.request("/database/query", token, {"query": statement, "read_only": False})[0]
            if any(boundary.values()):
                raise RuntimeError("Shared authenticated identity unexpectedly acquired AgentGrid membership")
        print(role + ": nonexistent/private resources and privileged publication denied")
    print("Live read-only boundaries passed; no application rows created. Real-account journeys remain separate gates.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Live boundary verification failed; no raw provider response logged.", file=sys.stderr)
        sys.exit(1)
