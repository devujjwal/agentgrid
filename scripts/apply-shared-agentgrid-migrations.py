#!/usr/bin/env python3
"""Guarded additive AgentGrid migration operator for the temporarily shared project."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("agentgrid_shared_audit", ROOT / "scripts/inspect-shared-supabase.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def command(arguments, *, environment=None):
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True, env=environment, check=False)
    if result.returncode:
        raise RuntimeError("Operator prerequisite failed: " + arguments[0])
    return result.stdout.strip()


def protected_guard():
    command([sys.executable, "scripts/inspect-shared-supabase.py", "--verify", "--rls", "--summary"])


def migration_sources():
    result = {}
    for position, path in enumerate(sorted((ROOT / "supabase/agentgrid/migrations").glob("*.sql")), 1):
        if path.is_symlink() or not path.is_file() or not re.fullmatch(rf"{position:03d}_[a-z0-9_]+", path.stem):
            raise RuntimeError("Unordered AgentGrid migration source")
        result[path.stem] = (path.read_text(), hashlib.sha256(path.read_bytes()).hexdigest())
    if not result:
        raise RuntimeError("No AgentGrid migration source")
    return result


def validate_history(history, sources):
    names = list(sources)
    if sorted(history) != names[:len(history)]:
        raise RuntimeError("Unknown or noncontiguous AgentGrid migration history")
    if any(history[name] != sources[name][1] for name in history):
        raise RuntimeError("Applied AgentGrid migration source has changed; use a new additive migration")


def private_write(path, value):
    temporary = path.with_suffix(".pending-write")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as file:
        json.dump(value, file, sort_keys=True, indent=2)
        file.write("\n")
    os.replace(temporary, path)


def owned_state_path():
    # Worktrees share the existing migration history and uncertain-write journal.
    # Do not create a replacement baseline in a worktree's private Git directory.
    common = Path(command(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"]))
    return common / "agentgrid-owned-schema-state.json"


def validate_checkout(commit):
    # An isolated detached checkout of the exact main commit avoids changing the
    # primary workspace. The remote-main and completed-CI checks remain below.
    if (command(["git", "branch", "--show-current"]) not in ("", "main")
        or command(["git", "rev-parse", "HEAD"]) != commit
        or command(["git", "status", "--porcelain"])):
        raise RuntimeError("Migration application requires a clean exact main commit checkout")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply only the clean, CI-validated exact main commit")
    parser.add_argument("--commit", help="Expected 40-character commit for --apply")
    args = parser.parse_args()
    sources = migration_sources()
    protected_guard()
    token = audit.load_token()

    def query(statement, read_only=True):
        return audit.request("/database/query", token, {"query": statement, "read_only": read_only})

    def installed_history():
        exists = query("select pg_catalog.to_regclass('public.agentgrid_schema_migrations') is not null as present;")[0]["present"]
        if not exists:
            return {}
        rows = query("select version,checksum from public.agentgrid_schema_migrations order by version;")
        return {row["version"]: row["checksum"] for row in rows}

    def owned_shape():
        inventory = query(audit.INVENTORY_SQL)[0]["inventory"]
        inventory.update(query(audit.SHAPE_SQL)[0]["shape"])
        protected = audit.protected_inventory(inventory)
        return {kind: [row for row in rows if row not in protected[kind]] for kind, rows in inventory.items()}

    state_path = owned_state_path()
    intent_path = state_path.with_name("agentgrid-owned-schema-intent.json")
    history = installed_history()
    validate_history(history, sources)
    shape = owned_shape()
    saved = json.loads(state_path.read_text()) if state_path.exists() else None
    if intent_path.exists():
        intent = json.loads(intent_path.read_text())
        previous = intent["before_history"]
        intended = {**previous, intent["version"]: intent["checksum"]}
        if (intent["project_ref"] != audit.PROJECT_REF or intent["version"] not in sources
            or sources[intent["version"]][1] != intent["checksum"]):
            raise RuntimeError("Unknown pending migration intent; refusing reconciliation")
        if history == previous and audit.digest(shape) == intent["before_shape_digest"]:
            # The whole transaction did not commit. Retrying needs a new verified --apply.
            intent_path.unlink()
        elif history == intended:
            # Exact transaction readback plus the protected guard resolves a lost
            # response. This records this operator's durable intent, never adopts
            # unrelated drift or replaces the original protected baseline.
            saved = {"project_ref": audit.PROJECT_REF, "history": history, "owned_schema_digest": audit.digest(shape)}
            private_write(state_path, saved)
            intent_path.unlink()
            print("Reconciled the exact pending AgentGrid migration transaction.")
        else:
            raise RuntimeError("Pending migration outcome is not the exact before/after state")
    if saved:
        if (saved["project_ref"] != audit.PROJECT_REF or saved["history"] != history
            or saved["owned_schema_digest"] != audit.digest(shape)):
            raise RuntimeError("Owned schema/history drift; refusing to replace its recorded state")
    elif history or any(shape.values()):
        raise RuntimeError("Unrecognized existing AgentGrid resources; refusing name collisions")
    pending = [name for name in sources if name not in history]
    print(f"Protected shared project verified. {len(history)} known migrations applied; {len(pending)} pending.")
    if not args.apply:
        for name in pending:
            print("Plan: " + name + " (AgentGrid-owned resources only)")
        return
    if not args.commit or not re.fullmatch(r"[a-f0-9]{40}", args.commit):
        raise RuntimeError("An exact validated commit is required")
    validate_checkout(args.commit)
    command(["pnpm", "verify:push"])
    tracked = command(["git", "ls-files", "--", "supabase/agentgrid/migrations"]).splitlines()
    expected_paths = [f"supabase/agentgrid/migrations/{name}.sql" for name in sources]
    if sorted(path for path in tracked if path.endswith(".sql")) != expected_paths:
        raise RuntimeError("Migration inputs must be exactly the committed flat SQL allowlist")
    remote = command(["git", "ls-remote", "origin", "refs/heads/main"]).split()[0]
    if remote != args.commit:
        raise RuntimeError("Personal remote main does not match the requested commit")
    personal = command(["gh", "auth", "token", "--hostname", "github.com", "--user", "devujjwal"])
    env = {**os.environ, "GH_TOKEN": personal}
    runs = json.loads(command(["gh", "run", "list", "--repo", "devujjwal/agentgrid", "--workflow", "ci.yml",
        "--branch", "main", "--commit", args.commit, "--event", "push", "--json", "status,conclusion,headSha"], environment=env))
    if not any(run["headSha"] == args.commit and run["status"] == "completed" and run["conclusion"] == "success" for run in runs):
        raise RuntimeError("Exact main commit has not passed Validate CI")
    for name in pending:
        protected_guard()
        contents, checksum = sources[name]
        private_write(intent_path, {"project_ref": audit.PROJECT_REF, "version": name, "checksum": checksum,
            "commit": args.commit, "before_history": history, "before_shape_digest": audit.digest(shape)})
        statement = ("begin; set local lock_timeout='5s'; set local statement_timeout='25s';\n" + contents
            + f"\ninsert into public.agentgrid_schema_migrations(version,checksum) values('{name}','{checksum}');\ncommit;")
        try:
            query(statement, read_only=False)
        except Exception:
            # No blind retry after an unknown provider/network outcome. The durable
            # intent permits exact readback reconciliation on the next invocation.
            raise RuntimeError("Migration result unavailable; re-run the read-only plan to reconcile its durable intent") from None
        expected = {**history, name: checksum}
        current = installed_history()
        if current != expected:
            raise RuntimeError("Applied transaction history does not match the exact intent")
        protected_guard()
        shape = owned_shape()
        private_write(state_path, {"project_ref": audit.PROJECT_REF, "history": current, "owned_schema_digest": audit.digest(shape)})
        intent_path.unlink()
        history = current
        print("Verified additive migration: " + name)
    print("AgentGrid migration application verified; protected resources unchanged.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Never log provider responses, credentials or application rows.
        print(str(error) if isinstance(error, RuntimeError) else "Migration operator failed; inspect its private state before retrying.", file=sys.stderr)
        sys.exit(1)
