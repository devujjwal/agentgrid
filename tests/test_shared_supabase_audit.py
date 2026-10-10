"""Offline security-boundary tests; never connect to Supabase or read credentials."""
import base64
import importlib.util
import json
from pathlib import Path
import unittest

source = Path(__file__).resolve().parents[1] / "scripts" / "inspect-shared-supabase.py"
spec = importlib.util.spec_from_file_location("shared_audit", source)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class SharedSupabaseAuditTests(unittest.TestCase):
    def test_affiliate_transition_rejects_existing_changes_and_unrelated_additions(self):
        before = {"tables": [{"schema": "public", "name": "prompts", "rls": True}], "functions": []}
        current = {"tables": before["tables"] + [{"schema": "public", "name": "affiliate_providers", "rls": True}], "functions": []}
        evidence = {"project_ref": audit.PROJECT_REF,
            "authorization": "owner-approved-picmagic-affiliate-release-2026-10-10",
            "source_sha256": "79dfe26e382a1bd9c9f9e00e88fccd08663cbb2c22ce648cb64f5e1b6898b12f",
            "source_fixture_verified": True, "before_digest": audit.digest(before), "after_digest": audit.digest(current)}
        self.assertTrue(audit.approved_affiliate_transition(before, current, evidence))
        for changed in (
            {"tables": [current["tables"][1]], "functions": []},
            {"tables": [{"schema": "public", "name": "prompts", "rls": False}, current["tables"][1]], "functions": []},
            {"tables": current["tables"], "functions": [{"schema": "public", "name": "unrelated"}]},
        ):
            evidence["after_digest"] = audit.digest(changed)
            self.assertFalse(audit.approved_affiliate_transition(before, changed, evidence))
        evidence["source_fixture_verified"] = False
        self.assertFalse(audit.approved_affiliate_transition(before, current, evidence))

    def google_transition_fixture(self):
        before = {
            "site_url": "https://picmagic.in",
            "smtp_host": None,
            "uri_allow_list": "https://picmagic.in/admin/login,https://picmagic-in.netlify.app/admin/login",
            "external_google_enabled": False,
            "external_google_client_id": None,
            "external_google_secret": None,
        }
        after = {**before,
            "external_google_enabled": True,
            "external_google_client_id": "937196090354-fixture.apps.googleusercontent.com",
            "external_google_secret": "GOCSPX-" + "0" * 28,
            "uri_allow_list": before["uri_allow_list"] + "," + audit.LOCAL_OAUTH_CALLBACK,
        }
        evidence = {
            "project_ref": audit.PROJECT_REF,
            "authorization": "owner-approved-initial-google-setup",
            "before_digest": audit.digest(before),
            "after_digest": audit.digest(after),
            "changed_fields": sorted(audit.GOOGLE_AUTH_FIELDS),
        }
        return before, after, evidence

    def test_recorded_google_transition_preserves_original_auth_baseline(self):
        before, after, evidence = self.google_transition_fixture()
        self.assertTrue(audit.approved_google_transition(audit.digest(before), before, after, evidence))
        after["external_google_secret"] = "GOCSPX-" + "1" * 28
        self.assertFalse(audit.approved_google_transition(audit.digest(before), before, after, evidence))

    def test_opaque_provider_secret_observation_is_bound_to_recorded_digest(self):
        before, after, evidence = self.google_transition_fixture()
        after["external_google_secret"] = "0" * 64
        evidence["after_digest"] = audit.digest(after)
        self.assertTrue(audit.approved_google_transition(audit.digest(before), before, after, evidence))
        after["external_google_secret"] = "1" * 64
        self.assertFalse(audit.approved_google_transition(audit.digest(before), before, after, evidence))

    def test_google_transition_cannot_hide_protected_changes_or_broader_redirects(self):
        for change in (
            {"site_url": "https://agentgrid.me"},
            {"smtp_host": "smtp.agentgrid.me"},
            {"uri_allow_list": "https://picmagic.in/admin/login,http://localhost:3027/**"},
            {"external_google_client_id": "123456-otherproject.apps.googleusercontent.com"},
        ):
            before, after, evidence = self.google_transition_fixture()
            after.update(change)
            evidence["after_digest"] = audit.digest(after)
            evidence["changed_fields"] = sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))
            self.assertFalse(audit.approved_google_transition(audit.digest(before), before, after, evidence))

    def test_keyring_decoding_and_header_injection_rejection(self):
        token = "sbp_" + "0" * 40
        for value in (
            token,
            "go-keyring-base64:" + base64.b64encode(token.encode()).decode(),
            "go-keyring-encoded:" + token.encode().hex(),
        ):
            self.assertEqual(audit.decode_keyring_value(value), token)
        for value in ("unsupported", token + "\nX-Injected: yes", "sbp_" + "0" * 39):
            with self.assertRaises(RuntimeError):
                audit.decode_keyring_value(value)

    def test_staging_delta_preserves_google_chain_and_rejects_other_auth_drift(self):
        before, google, google_evidence = self.google_transition_fixture()
        current = {**google, "uri_allow_list": google["uri_allow_list"] + "," + audit.STAGING_OAUTH_CALLBACK}
        evidence = {
            "project_ref": audit.PROJECT_REF,
            "authorization": "owner-approved-staging-configuration",
            "callback": audit.STAGING_OAUTH_CALLBACK,
            "changed_fields": ["uri_allow_list"],
            "before_digest": audit.digest(google), "after_digest": audit.digest(current),
        }
        check = lambda value, record: audit.approved_staging_transition(audit.digest(before), before, google_evidence, value, record)
        self.assertTrue(check(current, evidence))
        for change in (
            {"site_url": "https://agentgrid.me"},
            {"smtp_host": "changed"},
            {"external_google_secret": "GOCSPX-" + "1" * 28},
            {"uri_allow_list": current["uri_allow_list"] + ",https://attacker.example"},
            {"uri_allow_list": current["uri_allow_list"].replace(audit.STAGING_OAUTH_CALLBACK, "https://agentgrid-staging.pages.dev/**")},
        ):
            mutated = {**current, **change}
            self.assertFalse(check(mutated, {**evidence, "after_digest": audit.digest(mutated)}))

    def test_production_callback_preserves_full_prior_chain(self):
        before, google, google_evidence = self.google_transition_fixture()
        staging = {**google, "uri_allow_list": google["uri_allow_list"] + "," + audit.STAGING_OAUTH_CALLBACK}
        staging_evidence = {
            "project_ref": audit.PROJECT_REF, "authorization": "owner-approved-staging-configuration",
            "callback": audit.STAGING_OAUTH_CALLBACK, "changed_fields": ["uri_allow_list"],
            "before_digest": audit.digest(google), "after_digest": audit.digest(staging),
        }
        current = {**staging, "uri_allow_list": staging["uri_allow_list"] + "," + audit.PRODUCTION_OAUTH_CALLBACK}
        evidence = {
            "project_ref": audit.PROJECT_REF, "authorization": "owner-authorized-production-launch",
            "callback": audit.PRODUCTION_OAUTH_CALLBACK, "changed_fields": ["uri_allow_list"],
            "before_digest": audit.digest(staging), "after_digest": audit.digest(current),
        }
        check = lambda value, record: audit.approved_production_transition(audit.digest(before), before, google_evidence, staging_evidence, value, record)
        self.assertTrue(check(current, evidence))
        for change in (
            {"site_url": "https://agentgrid.me"}, {"smtp_host": "changed"},
            {"external_google_secret": "changed"},
            {"uri_allow_list": current["uri_allow_list"] + ",https://attacker.example"},
            {"uri_allow_list": current["uri_allow_list"].replace(audit.PRODUCTION_OAUTH_CALLBACK, "https://agentgrid.me/**")},
            {"uri_allow_list": current["uri_allow_list"] + "," + audit.PRODUCTION_OAUTH_CALLBACK},
        ):
            mutated = {**current, **change}
            self.assertFalse(check(mutated, {**evidence, "after_digest": audit.digest(mutated)}))
        self.assertFalse(check(current, {**evidence, "before_digest": "0" * 64}))

    def test_protected_resources_remain_in_fingerprint_after_agentgrid_additions(self):
        original = {
            "tables": [{"name": "prompts", "rls": True}],
            "policies": [{"policyname": "Read public", "qual": "is_published"}],
            "columns": [{"table": "prompts", "name": "id", "type": "uuid"}],
            "buckets": [{"id": "previews", "public": True}],
        }
        expanded = {
            key: rows + [row]
            for (key, rows), row in zip(original.items(), (
                {"name": "agentgrid_agents", "rls": True},
                {"policyname": "agentgrid_read_published", "qual": "published"},
                {"table": "agentgrid_agents", "name": "id", "type": "uuid"},
                {"id": "agentgrid_avatars", "public": True},
            ))
        }
        self.assertEqual(audit.protected_inventory(expanded), original)
        expanded["tables"][0] = {"name": "prompts", "rls": False}
        self.assertNotEqual(audit.digest(audit.protected_inventory(expanded)), audit.digest(original))

    def test_rls_probe_is_read_only_with_valid_claims_and_closed_role_allowlist(self):
        for role in ("anon", "authenticated"):
            query = audit.isolation_query(role)
            self.assertTrue(query.startswith("begin read only;"))
            self.assertTrue(query.endswith("commit;"))
            claims = query.split("request.jwt.claims = '", 1)[1].split("';", 1)[0]
            self.assertEqual(json.loads(claims)["role"], role)
        with self.assertRaises(ValueError):
            audit.isolation_query("authenticated; delete from public.prompts")


if __name__ == "__main__":
    unittest.main()
