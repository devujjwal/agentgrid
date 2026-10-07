import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/test-database.py"
spec = importlib.util.spec_from_file_location("agentgrid_database_test", SCRIPT)
database = importlib.util.module_from_spec(spec)
spec.loader.exec_module(database)


class DatabaseImageTests(unittest.TestCase):
    def test_cached_digest_needs_no_registry_request(self):
        with patch.object(database, "run", return_value="sha256:verified") as run:
            self.assertEqual(database.ensure_image(), database.IMAGE)
            self.assertEqual(run.call_count, 1)
            self.assertEqual(run.call_args.args[0][1:3], ["image", "inspect"])

    def test_official_mirror_retains_exact_digest_and_all_failures_block(self):
        self.assertEqual(database.IMAGE.split("@", 1)[1], database.IMAGE_MIRROR.split("@", 1)[1])
        with patch.object(database, "run", side_effect=[RuntimeError(), RuntimeError(), RuntimeError(), "pulled"]):
            self.assertEqual(database.ensure_image(), database.IMAGE_MIRROR)
        with patch.object(database, "run", side_effect=RuntimeError()):
            with self.assertRaises(RuntimeError):
                database.ensure_image()
