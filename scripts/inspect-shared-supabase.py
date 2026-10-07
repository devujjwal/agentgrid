#!/usr/bin/env python3
"""Read-only shared-project inventory. No tokens or user records are printed."""
import base64
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess

PROJECT_REF = "lxecbrvzpmgjmsqiachc"


def decode_keyring_value(value):
    """Mirror go-keyring's documented macOS encoding without printing secrets."""
    if value.startswith("go-keyring-base64:"):
        value = base64.b64decode(value.split(":", 1)[1], validate=True).decode()
    elif value.startswith("go-keyring-encoded:"):
        value = bytes.fromhex(value.split(":", 1)[1]).decode()
    if not re.fullmatch(r"sbp_(?:oauth_)?[a-f0-9]{40}", value):
        raise RuntimeError("Existing Supabase CLI credential has an unsupported format")
    return value


def load_token():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if token:
        return decode_keyring_value(token.strip())
    result = subprocess.run(
        ["security", "find-generic-password", "-s", "Supabase CLI", "-a", "access-token", "-w"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        return decode_keyring_value(result.stdout.strip())
    return decode_keyring_value((Path.home() / ".supabase" / "access-token").read_text().strip())


def request(path, token, body=None):
    # macOS curl validates TLS using the system trust store. Credentials travel
    # through stdin, never command-line arguments or a persisted configuration.
    if path not in ("/database/query", "/config/auth"):
        raise ValueError("Unsupported metadata endpoint")
    command = ["/usr/bin/curl", "--silent", "--show-error", "--max-time", "30", "--write-out", "\n%{http_code}", "--header", "@-"]
    if body is not None:
        command += ["--data-binary", json.dumps(body)]
    command += ["https://api.supabase.com/v1/projects/" + PROJECT_REF + path]
    result = subprocess.run(command, input="Authorization: Bearer " + token + "\nContent-Type: application/json\n", capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError("Supabase metadata request failed with curl status " + str(result.returncode))
    response_body, status = result.stdout.rsplit("\n", 1)
    if int(status) >= 400:
        try:
            message = str(json.loads(response_body).get("message", "Request rejected"))[:500]
        except (ValueError, AttributeError):
            message = "Request rejected"
        message = re.sub(r"sbp_[A-Za-z0-9_]+|sb_secret_[A-Za-z0-9_-]+", "[redacted]", message)
        raise RuntimeError("Supabase metadata HTTP " + status + ": " + message)
    return json.loads(response_body)


INVENTORY_SQL = """
select jsonb_build_object(
 'tables', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by n.nspname,c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','wonder_private') and c.relkind in ('r','p','v','m')),
 'policies', (select coalesce(jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname),'[]') from pg_policies p where schemaname in ('public','wonder_private','storage')),
 'functions', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),'definition',pg_get_functiondef(p.oid),'security_definer',p.prosecdef,'config',p.proconfig) order by p.proname,p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','wonder_private') and p.prokind='f'),
 'triggers', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'definition',pg_get_triggerdef(t.oid),'function',p.proname) order by n.nspname,c.relname,t.tgname),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and n.nspname in ('public','wonder_private','auth','storage')),
 'buckets', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id),'[]') from storage.buckets),
 'grants', (select coalesce(jsonb_agg(to_jsonb(g) order by table_schema,table_name,grantee,privilege_type),'[]') from information_schema.role_table_grants g where table_schema='public' and grantee in ('anon','authenticated'))
) as inventory;
"""

# Table shape is private audit evidence, never a publication input. This detects
# accidental column/constraint/index/ACL changes as well as names and policies.
SHAPE_SQL = """
select jsonb_build_object(
 'columns', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by c.relname,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname in ('public','wonder_private') and c.relkind in ('r','p','v','m') and a.attnum>0 and not a.attisdropped),
 'constraints', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid)) order by c.relname,k.conname),'[]') from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','wonder_private')),
 'indexes', (select coalesce(jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',indexname,'definition',indexdef) order by tablename,indexname),'[]') from pg_indexes where schemaname in ('public','wonder_private')),
 'table_acls', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'acl',c.relacl) order by c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','wonder_private') and c.relkind in ('r','p','v','m')),
 'function_acls', (select coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'signature',pg_get_function_identity_arguments(p.oid),'acl',p.proacl) order by p.proname,p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','wonder_private') and p.prokind='f')
) as shape;
"""


def protected_inventory(inventory):
    """Exclude only clearly AgentGrid-owned resources from comparison."""
    fields = {"policies": "policyname", "grants": "table_name", "buckets": "id"}
    result = {}
    for kind, resources in inventory.items():
        key = fields.get(kind, "table" if kind in ("columns", "constraints", "indexes") else "name")
        result[kind] = [row for row in resources if not row[key].startswith("agentgrid_")]
    return result


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def isolation_query(role):
    if role not in ("anon", "authenticated"):
        raise ValueError("Unsupported audit role")
    # The metadata read_only option uses a restricted role which cannot SET ROLE.
    # PostgreSQL enforces read-only instead; all temporary role/JWT settings end
    # at COMMIT. No auth user or application row is created for this check.
    claims = json.dumps({"sub": "99883173-58f3-4d6a-96a5-0f116c981d21", "role": role})
    return f"""begin read only;
set local role {role};
set local request.jwt.claims = '{claims}';
select jsonb_build_object(
 'picmagic_admin', public.is_admin(),
 'private_prompts_visible', exists(select 1 from public.prompts where not is_published),
 'inactive_collections_visible', exists(select 1 from public.collections where not active),
 'private_articles_visible', exists(select 1 from public.blog_articles where status<>'published' or date_published>now()),
 'other_admin_roles_visible', exists(select 1 from public.admin_users)
) as isolation;
commit;"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Fail if protected resources differ from the recorded baseline")
    parser.add_argument("--rls", action="store_true", help="Run non-mutating PicMagic access-denial checks")
    args = parser.parse_args()
    token = load_token()
    rows = request("/database/query", token, {"query": INVENTORY_SQL, "read_only": True})
    inventory = rows[0]["inventory"]
    inventory.update(request("/database/query", token, {"query": SHAPE_SQL, "read_only": True})[0]["shape"])
    auth = request("/config/auth", token)
    baseline = {
        "project_ref": PROJECT_REF,
        "inventory": protected_inventory(inventory),
        "auth_config_digest": digest(auth),
    }
    git_path = subprocess.check_output(["git", "rev-parse", "--git-path", "agentgrid-protected-baseline-v2.json"], text=True).strip()
    path = Path(git_path)
    if args.verify:
        original = json.loads(path.read_text())
        changed = [key for key in original["inventory"] if original["inventory"][key] != baseline["inventory"][key]]
        if changed or original["auth_config_digest"] != baseline["auth_config_digest"]:
            raise RuntimeError("Protected shared-project baseline changed: " + ", ".join(changed or ["auth configuration"]))
        print("Protected schema and shared auth configuration unchanged.")
    elif not path.exists():
        path.write_text(json.dumps(baseline, indent=2) + "\n")
        path.chmod(0o600)
    if args.rls:
        for role in ("anon", "authenticated"):
            result = request("/database/query", token, {"query": isolation_query(role)})[0]["isolation"]
            if any(result.values()):
                raise RuntimeError("Protected data visible to audit role " + role)
            print("PicMagic access-denial checks passed for " + role + ".")
    print(json.dumps({
        "project_ref": PROJECT_REF,
        "tables": inventory["tables"],
        "policies": inventory["policies"],
        "triggers": inventory["triggers"],
        "function_names": [f["name"] for f in inventory["functions"]],
        "buckets": inventory["buckets"],
        "agentgrid_collisions": [t["name"] for t in inventory["tables"] if t["name"].startswith("agentgrid_")],
        "auth": {key: auth.get(key) for key in [
            "site_url", "uri_allow_list", "external_google_enabled", "external_email_enabled",
            "mailer_autoconfirm", "smtp_host", "smtp_port", "smtp_admin_email", "smtp_sender_name",
            "mailer_otp_exp", "mailer_otp_length", "security_captcha_enabled",
        ]},
    }, indent=2))


if __name__ == "__main__":
    main()
