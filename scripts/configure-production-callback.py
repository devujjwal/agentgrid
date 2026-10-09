#!/usr/bin/env python3
"""Add only the approved exact AgentGrid production callback. No secret is persisted."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("audit", ROOT / "scripts/inspect-shared-supabase.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def main():
    if os.environ.get("CI") or os.environ.get("GITHUB_ACTIONS") or sys.argv[1:] not in ([], ["--apply"]):
        raise RuntimeError()
    git_dir = Path(subprocess.check_output(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], text=True).strip())
    original = json.loads((git_dir / "agentgrid-protected-baseline-v2.json").read_text())
    before_google = json.loads((git_dir / "agentgrid-google-auth-before.json").read_text())
    google_evidence = json.loads((git_dir / "agentgrid-google-auth-transition.json").read_text())
    evidence_path = git_dir / "agentgrid-production-auth-transition.json"
    staging_evidence = json.loads((git_dir / "agentgrid-staging-auth-transition.json").read_text())
    token = audit.load_token()
    current = audit.request("/config/auth", token)
    if evidence_path.exists() and audit.approved_production_transition(
        original["auth_config_digest"], before_google, google_evidence, staging_evidence, current,
        json.loads(evidence_path.read_text()),
    ):
        print("Exact production callback already verified; no changes made.")
        return
    if not audit.approved_staging_transition(original["auth_config_digest"], before_google, google_evidence, current, staging_evidence):
        raise RuntimeError()
    expected = {**current, "uri_allow_list": current["uri_allow_list"] + "," + audit.PRODUCTION_OAUTH_CALLBACK}
    evidence = {
        "project_ref": audit.PROJECT_REF,
        "authorization": "owner-authorized-production-launch",
        "callback": audit.PRODUCTION_OAUTH_CALLBACK,
        "changed_fields": ["uri_allow_list"],
        "before_digest": audit.digest(current), "after_digest": audit.digest(expected),
    }
    if not audit.approved_production_transition(original["auth_config_digest"], before_google, google_evidence, staging_evidence, expected, evidence):
        raise RuntimeError()
    if not sys.argv[1:]:
        print("Prepared one additive exact production callback; all other auth fields preserved.")
        return
    if evidence_path.exists():
        if json.loads(evidence_path.read_text()) != evidence:
            raise RuntimeError()
    else:
        # Only digests and callback metadata; no auth configuration/credentials.
        descriptor = os.open(evidence_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w") as output:
            json.dump(evidence, output, indent=2)
    quote = lambda value: '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r') + '"'
    configuration = "\n".join([
        "silent", "max-time = 30", 'request = "PATCH"',
        "url = " + quote("https://api.supabase.com/v1/projects/" + audit.PROJECT_REF + "/config/auth"),
        "header = " + quote("Authorization: Bearer " + token),
        'header = "Content-Type: application/json"',
        "data-binary = " + quote(json.dumps({"uri_allow_list": expected["uri_allow_list"]})),
        'write-out = "\\n%{http_code}"',
    ])
    result = subprocess.run(["/usr/bin/curl", "--config", "-"], input=configuration, text=True, capture_output=True)
    if result.returncode or result.stdout.rsplit("\n", 1)[-1] != "200":
        raise RuntimeError()
    after = audit.request("/config/auth", token)
    if after != expected:
        raise RuntimeError()
    print("Production callback configured and verified; PicMagic Site URL, SMTP, templates and all other auth fields unchanged.")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Production callback not verified. Inspect exact provider state before retrying; no diagnostics or secrets printed.", file=sys.stderr)
        sys.exit(1)
