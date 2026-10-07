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
