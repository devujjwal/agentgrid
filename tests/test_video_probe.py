"""Decoder contract tests use subprocess fixtures; no paid services or production media."""
import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("video_probe", Path(__file__).parents[1] / "backend/video-probe/server.py")
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)

class VideoProbeTest(unittest.TestCase):
    def test_local_decoder_and_cleanup(self):
        captured = []
        def run(args, **options):
            captured.append(Path(args[-1]))
            self.assertTrue(captured[0].exists())
            self.assertIn("file,pipe", args)
            self.assertEqual(options["timeout"], 20)
            self.assertEqual(options["stderr"], subprocess.DEVNULL)
            return subprocess.CompletedProcess(args, 0, json.dumps({"streams": [{"codec_type": "video", "codec_name": "h264", "width": 720, "height": 1280}, {"codec_type": "audio", "codec_name": "aac"}], "format": {"duration": "10.25"}}).encode())
        with patch.object(probe.subprocess, "run", side_effect=run):
            result = probe.decode_video(b"0000ftyp0000")
        self.assertEqual(result["seconds"], 10.25)
        self.assertEqual(result["audioCodec"], "aac")
        self.assertFalse(captured[0].exists())

    def test_reject_invalid_container_and_multiple_streams(self):
        with patch.object(probe.subprocess, "run") as run:
            with self.assertRaises(ValueError):
                probe.decode_video(b"0000html0000")
            run.assert_not_called()
        result = subprocess.CompletedProcess([], 0, b'{"streams":[],"format":{"duration":"10"}}')
        with patch.object(probe.subprocess, "run", return_value=result):
            with self.assertRaises(ValueError):
                probe.decode_video(b"0000ftyp0000")
