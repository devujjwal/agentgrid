#!/usr/bin/env python3
"""Recreate AgentGrid in a disposable, network-isolated database; never target Supabase."""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
IMAGE = (
    "public.ecr.aws/supabase/postgres:17.6.1.167"
    "@sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb"
)
PURPOSE = "agentgrid-disposable-schema-test"

# Compare protected fixtures and global grants as well as application data. The
# real project's separate read-only inventory is still required before remote DDL.
PROTECTED_SNAPSHOT = """
select jsonb_build_object(
 'relations', (select jsonb_agg(to_jsonb(x) order by x.name) from (
   select c.relname as name, c.relacl::text as acl, c.relrowsecurity as rls,
     c.relforcerowsecurity as forced
   from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','auth') and c.relname not like 'agentgrid\\_%' escape '\\'
 ) x),
 'columns', (select jsonb_agg(to_jsonb(x) order by x.table_name,x.ordinal_position) from (
   select table_schema,table_name,column_name,ordinal_position,data_type,is_nullable,column_default
   from information_schema.columns where table_schema in ('public','auth')
   and table_name not like 'agentgrid\\_%' escape '\\'
 ) x),
 'constraints', (select jsonb_agg(to_jsonb(x) order by x.name) from (
   select k.conname as name, pg_catalog.pg_get_constraintdef(k.oid) as definition
   from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','auth') and c.relname not like 'agentgrid\\_%' escape '\\'
 ) x),
 'policies', (select jsonb_agg(to_jsonb(x) order by x.tablename,x.policyname) from (
   select * from pg_catalog.pg_policies where schemaname in ('public','auth')
   and tablename not like 'agentgrid\\_%' escape '\\'
 ) x),
 'functions', (select jsonb_agg(to_jsonb(x) order by x.name,x.definition) from (
   select p.proname as name, pg_catalog.pg_get_functiondef(p.oid) as definition,p.proacl::text as acl
   from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('public','auth') and p.prokind='f'
   and p.proname not like 'agentgrid\\_%' escape '\\'
 ) x),
 'triggers', (select jsonb_agg(pg_catalog.pg_get_triggerdef(t.oid) order by t.tgname)
   from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','auth') and not t.tgisinternal
   and c.relname not like 'agentgrid\\_%' escape '\\'),
 'default_grants', (select jsonb_agg(to_jsonb(x) order by x.defaclrole,x.defaclnamespace,x.defaclobjtype)
   from pg_catalog.pg_default_acl x),
 'roles', (select jsonb_agg(to_jsonb(x) order by x.rolname) from pg_catalog.pg_roles x),
 'memberships', (select jsonb_agg(to_jsonb(x) order by x.roleid,x.member) from pg_catalog.pg_auth_members x),
 'private_rows', (select jsonb_agg(to_jsonb(x)) from public.picmagic_private_fixture x),
 'admin_rows', (select jsonb_agg(to_jsonb(x)) from public.picmagic_admin_fixture x),
 'auth_rows', (select jsonb_agg(to_jsonb(x) order by x.id) from auth.users x)
);
"""


def run(arguments, *, input_text=None, timeout=120):
    result = subprocess.run(
        arguments, input=input_text, capture_output=True, text=True, timeout=timeout, check=False
    )
    if result.returncode:
        # All database inputs are synthetic fixtures; credentials are never read.
        raise RuntimeError(f"Local database test failed: {result.stderr[-2000:].strip()}")
    return result.stdout.strip()


def main():
    run(["docker", "info", "--format", "{{.OSType}}"])
    # Pull only the pinned public vendor image. No app infrastructure, ports,
    # protected containers, shared volumes or private data enter this test.
    run(["docker", "pull", IMAGE], timeout=300)
    suffix = uuid.uuid4().hex
    name = f"agentgrid_schema_qa_{suffix}"
    database = f"agentgrid_qa_{suffix}"
    container = None
    try:
        container = run([
            "docker", "run", "--detach", "--network", "none", "--name", name,
            "--label", f"com.agentgrid.purpose={PURPOSE}",
            "--env", "POSTGRES_PASSWORD=agentgrid_local_fixture_only", IMAGE,
        ])
        if not re.fullmatch(r"[a-f0-9]{64}", container):
            raise RuntimeError("Unexpected disposable container identity")
        deadline = time.monotonic() + 60
        while True:
            try:
                # The image briefly starts a temporary server during initdb.
                # Readiness on that process would race its scheduled shutdown.
                if "PostgreSQL init process complete; ready for start up." not in run(["docker", "logs", container], timeout=10):
                    raise RuntimeError("Disposable database is still initializing")
                run(["docker", "exec", container, "pg_isready", "-U", "postgres"], timeout=10)
                break
            except RuntimeError:
                if time.monotonic() >= deadline:
                    raise RuntimeError("Disposable database readiness timed out") from None
                time.sleep(1)
        run(["docker", "exec", container, "createdb", "-U", "postgres", "--template", "template0", database])

        def sql(statement):
            return run([
                "docker", "exec", "--interactive", container, "psql", "-U", "postgres",
                "--dbname", database, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
            ], input_text=statement)

        directory = ROOT / "supabase/agentgrid"
        sql((directory / "tests/bootstrap.sql").read_text())
        before = json.loads(sql(PROTECTED_SNAPSHOT))
        migrations = sorted((directory / "migrations").glob("*.sql"))
        if not migrations:
            raise RuntimeError("No AgentGrid migrations found")
        for position, path in enumerate(migrations, 1):
            if not re.fullmatch(rf"{position:03d}_[a-z0-9_]+", path.stem):
                raise RuntimeError("Migration history must be ordered without gaps")
            contents = path.read_text()
            checksum = hashlib.sha256(contents.encode()).hexdigest()
            sql(
                "begin;\n" + contents
                + f"\ninsert into public.agentgrid_schema_migrations (version, checksum) "
                + f"values ('{path.stem}','{checksum}');\ncommit;"
            )
        for path in sorted((directory / "tests").glob("*.sql")):
            if path.name != "bootstrap.sql":
                draft = json.loads((ROOT / "content/agents/inbox-priority-triage/1.0.0.agent.json").read_text())
                fixture = json.dumps(draft).replace("'", "''")
                sql("select pg_catalog.set_config('agentgrid.fixture_specification','" + fixture + "',false);\n" + path.read_text())
        after = json.loads(sql(PROTECTED_SNAPSHOT))
        if before != after:
            changed = sorted(key for key in before if before[key] != after[key])
            raise RuntimeError(f"Protected fixture boundary changed: {', '.join(changed)}")
        history = json.loads(sql(
            "select jsonb_object_agg(version,checksum) from public.agentgrid_schema_migrations;"
        ))
        expected = {path.stem: hashlib.sha256(path.read_bytes()).hexdigest() for path in migrations}
        if history != expected:
            raise RuntimeError("Migration history/checksums do not match the repository")
        print(f"Database acceptance passed: {len(migrations)} migrations; protected fixtures unchanged.")
    finally:
        if container:
            details = json.loads(run(["docker", "inspect", container]))[0]
            if (
                details["Id"] != container
                or details["Name"] != f"/{name}"
                or details["Config"]["Labels"].get("com.agentgrid.purpose") != PURPOSE
                or details["HostConfig"]["NetworkMode"] != "none"
            ):
                raise RuntimeError("Disposable container ownership check failed; refusing cleanup")
            run(["docker", "rm", "--force", "--volumes", container])


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
