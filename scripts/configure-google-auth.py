#!/usr/bin/env python3
"""Apply the owner's approved initial Google setup; preserve all other auth fields."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("shared_audit", ROOT / "scripts/inspect-shared-supabase.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def curl_quote(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r') + '"'


def patch_auth(token, payload):
    if set(payload) != audit.GOOGLE_AUTH_FIELDS:
        raise RuntimeError("Refusing auth configuration outside the approved Google fields")
    # Both credentials and request body travel through stdin, not process args.
    configuration = "\n".join([
        "silent", "show-error", "max-time = 30", 'request = "PATCH"',
        "url = " + curl_quote("https://api.supabase.com/v1/projects/" + audit.PROJECT_REF + "/config/auth"),
        "header = " + curl_quote("Authorization: Bearer " + token),
        'header = "Content-Type: application/json"',
        "data-binary = " + curl_quote(json.dumps(payload)),
        'write-out = "\\n%{http_code}"',
    ])
    result = subprocess.run(["/usr/bin/curl", "--config", "-"], input=configuration, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("Google configuration transport failed; no credentials logged")
    _, status = result.stdout.rsplit("\n", 1)
    if status != "200":
        raise RuntimeError("Google configuration HTTP " + status + "; response body withheld")


def write_private(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf8") as target:
        json.dump(value, target, indent=2)
        target.write("\n")


def main():
    if os.environ.get("CI"):
        raise RuntimeError("Provider configuration must never run in CI")
    record_only = sys.argv[1:] == ["--record-approved-result"]
    if not record_only and sys.argv[1:] != ["--apply-owner-approved-setup"]:
        raise RuntimeError("Explicit approved-setup flag required; never run this in CI")
    values = dict(line.split("=", 1) for line in (ROOT / ".env.agentgrid.local").read_text().splitlines() if "=" in line and not line.startswith("#"))
    client = values.get("GOOGLE_CLIENT_ID", "")
    secret = values.get("GOOGLE_CLIENT_SECRET", "")
    if not re.fullmatch(r"937196090354-[a-z0-9]+\.apps\.googleusercontent\.com", client) or not re.fullmatch(r"GOCSPX-[A-Za-z0-9_-]{20,}", secret):
        raise RuntimeError("Expected approved AgentGrid Google credentials are missing")
    git_dir = Path(subprocess.check_output(["git", "rev-parse", "--absolute-git-dir"], cwd=ROOT, text=True).strip())
    baseline = json.loads((git_dir / "agentgrid-protected-baseline-v2.json").read_text())
    token = audit.load_token()
    before_path = git_dir / "agentgrid-google-auth-before.json"
    evidence_path = git_dir / "agentgrid-google-auth-transition.json"
    if record_only:
        before = json.loads(before_path.read_text())
    else:
        before = audit.request("/config/auth", token)
    if audit.digest(before) != baseline["auth_config_digest"]:
        raise RuntimeError("Shared auth has drifted; inspect before changing anything")
    if before.get("external_google_enabled") or before.get("external_google_client_id") or before.get("external_google_secret"):
        raise RuntimeError("Existing Google configuration is protected; refusing replacement")
    payload = {
        "external_google_enabled": True,
        "external_google_client_id": client,
        "external_google_secret": secret,
        "uri_allow_list": ",".join([item for item in (before.get("uri_allow_list") or "").split(",") if item] + [audit.LOCAL_OAUTH_CALLBACK]),
    }
    if evidence_path.exists() or (before_path.exists() and not record_only):
        raise RuntimeError("Existing transition evidence will not be overwritten; inspect prior operation")
    if not record_only:
        write_private(before_path, before)
        patch_auth(token, payload)
    after = audit.request("/config/auth", token)
    expected = {**before, **payload}
    representation = after.get("external_google_secret")
    if representation != secret and re.fullmatch(r"[a-f0-9]{64}", representation or ""):
        expected["external_google_secret"] = representation
    if after != expected:
        raise RuntimeError("Auth configuration differs from the exact approved delta; evidence retained for investigation")
    evidence = {
        "project_ref": audit.PROJECT_REF,
        "authorization": "owner-approved-initial-google-setup",
        "before_digest": audit.digest(before),
        "after_digest": audit.digest(after),
        "changed_fields": sorted(payload),
    }
    if not audit.approved_google_transition(baseline["auth_config_digest"], before, after, evidence):
        raise RuntimeError("Approved delta validation failed; original baseline retained")
    write_private(evidence_path, evidence)
    print("Approved Google provider enabled with exact localhost callback; every other auth field unchanged.")
    print("Original protected baseline retained; authorized delta recorded privately without exposing credentials.")
    print("Management responses use an opaque secret representation; real Google code exchange remains required.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError) as error:
        # Never serialize remote data or private configuration in exception output.
        print("Google setup stopped safely: " + str(error) if isinstance(error, RuntimeError) else "Google setup stopped safely; inspect local configuration/evidence.", file=sys.stderr)
        sys.exit(1)
