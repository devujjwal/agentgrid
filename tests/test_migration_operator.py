import importlib.util
import contextlib
import io
import json
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/apply-shared-agentgrid-migrations.py"
spec = importlib.util.spec_from_file_location("agentgrid_migration_operator", SCRIPT)
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)


class MigrationOperatorTests(unittest.TestCase):
    def test_isolated_exact_main_checkout_must_be_clean_and_match_commit(self):
        commit = "a" * 40
        for branch, head, dirty, accepted in (
            ("main", commit, "", True), ("", commit, "", True),
            ("codex/other", commit, "", False), ("", "b" * 40, "", False),
            ("", commit, " M owned-file", False),
        ):
            def fake_command(arguments, **options):
                return {
                    ("git", "branch", "--show-current"): branch,
                    ("git", "rev-parse", "HEAD"): head,
                    ("git", "status", "--porcelain"): dirty,
                }[tuple(arguments)]
            with patch.object(operator, "command", fake_command):
                if accepted:
                    operator.validate_checkout(commit)
                else:
                    with self.assertRaises(RuntimeError):
                        operator.validate_checkout(commit)

    def test_history_cannot_adopt_unknown_gaps_or_rewritten_applied_source(self):
        sources = {"001_identity": ("reviewed SQL", "a" * 64), "002_resources": ("reviewed SQL", "b" * 64)}
        operator.validate_history({}, sources)
        operator.validate_history({"001_identity": "a" * 64}, sources)
        for history in ({"002_resources": "b" * 64}, {"001_identity": "c" * 64}, {"999_other": "a" * 64}):
            with self.assertRaises(RuntimeError):
                operator.validate_history(history, sources)

    def test_unvalidated_or_non_main_application_never_sends_ddl(self):
        with tempfile.TemporaryDirectory() as temporary:
            state_path = Path(temporary) / "agentgrid-owned-schema-state.json"
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
                if arguments == ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"]:
                    return temporary
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

    def test_linked_worktree_reads_existing_common_state_and_pending_intent(self):
        with tempfile.TemporaryDirectory() as temporary:
            repository = Path(temporary) / "repository"
            worktree = Path(temporary) / "worktree"
            repository.mkdir()

            def git(*arguments):
                subprocess.run(["git", "-C", str(repository), *arguments],
                    check=True, capture_output=True, text=True)

            git("init")
            git("config", "user.name", "Disposable fixture")
            git("config", "user.email", "fixture@example.invalid")
            git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", "Synthetic fixture")
            git("worktree", "add", "--detach", str(worktree))
            expected = repository / ".git" / "agentgrid-owned-schema-state.json"
            intent = expected.with_name("agentgrid-owned-schema-intent.json")
            expected.write_text('{"existing":"baseline"}')
            intent.write_text('{"existing":"uncertain transaction"}')
            before = (expected.read_bytes(), intent.read_bytes())
            with patch.object(operator, "ROOT", worktree):
                selected = operator.owned_state_path()
            self.assertEqual(selected.resolve(), expected.resolve())
            self.assertEqual((selected.read_bytes(), selected.with_name(intent.name).read_bytes()), before)
            self.assertEqual((expected.read_bytes(), intent.read_bytes()), before)

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
