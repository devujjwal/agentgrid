import importlib.util
import contextlib
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/apply-shared-agentgrid-migrations.py"
spec = importlib.util.spec_from_file_location("agentgrid_migration_operator", SCRIPT)
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)


class MigrationOperatorTests(unittest.TestCase):
    def test_history_cannot_adopt_unknown_gaps_or_rewritten_applied_source(self):
        sources = {"001_identity": ("reviewed SQL", "a" * 64), "002_resources": ("reviewed SQL", "b" * 64)}
        operator.validate_history({}, sources)
        operator.validate_history({"001_identity": "a" * 64}, sources)
        for history in ({"002_resources": "b" * 64}, {"001_identity": "c" * 64}, {"999_other": "a" * 64}):
            with self.assertRaises(RuntimeError):
                operator.validate_history(history, sources)

    def test_unvalidated_or_non_main_application_never_sends_ddl(self):
        with tempfile.TemporaryDirectory() as temporary:
            state_path = Path(temporary) / "owned-state.json"
            requests = []

            def fake_request(path, token, body):
                self.assertEqual(path, "/database/query")
                self.assertTrue(body["read_only"], "Unvalidated application attempted a write")
                requests.append(body)
                if body["query"] == operator.audit.INVENTORY_SQL:
                    return [{"inventory": {"tables": [], "functions": []}}]
                if body["query"] == operator.audit.SHAPE_SQL:
                    return [{"shape": {"columns": [], "constraints": []}}]
                if "to_regclass" in body["query"]:
                    return [{"present": False}]
                self.fail("Unexpected operator query")

            def fake_command(arguments, **options):
                if arguments[:3] == ["git", "rev-parse", "--git-path"]:
                    return str(state_path)
                if arguments[:3] == ["git", "branch", "--show-current"]:
                    return "codex/unvalidated"
                self.fail("Unexpected prerequisite command")

            with contextlib.redirect_stdout(io.StringIO()), patch.object(operator, "protected_guard"), patch.object(operator, "command", fake_command), \
                 patch.object(operator.audit, "load_token", return_value="synthetic-test-token"), \
                 patch.object(operator.audit, "request", fake_request):
                for commit in ("not-a-commit", "a" * 40):
                    with patch("sys.argv", [str(SCRIPT), "--apply", "--commit", commit]):
                        with self.assertRaises(RuntimeError):
                            operator.main()
            self.assertTrue(requests)
            self.assertFalse(state_path.exists())

    def test_private_operator_record_is_atomic_restricted_and_does_not_clobber_pending_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "owned-state.json"
            operator.private_write(path, {"fixture": "first"})
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(json.loads(path.read_text()), {"fixture": "first"})
            pending = path.with_suffix(".pending-write")
            pending.write_text("preexisting intent")
            with self.assertRaises(FileExistsError):
                operator.private_write(path, {"fixture": "second"})
            self.assertEqual(json.loads(path.read_text()), {"fixture": "first"})
            self.assertEqual(pending.read_text(), "preexisting intent")


if __name__ == "__main__":
    unittest.main()
