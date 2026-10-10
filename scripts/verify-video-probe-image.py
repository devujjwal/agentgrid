"""Exercise the actual inspection image using synthetic media and no networking."""
import argparse
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("image")
args = parser.parse_args()
fixture = Path(__file__).parents[1] / "tests/fixtures/video-probe-portrait.mp4"
program = r'''
import os, sys, subprocess
from server import decode_video
assert os.getuid() == 65534, "Image must run as its unprivileged user"
result = decode_video(sys.stdin.buffer.read())
assert result == {"width": 720, "height": 1280, "seconds": 1.0,
                  "videoCodec": "h264", "audioCodec": "aac"}, result
for data in (b"0000html0000", b"0000ftyp0000"):
    try:
        decode_video(data)
    except (ValueError, KeyError, subprocess.SubprocessError):
        pass
    else:
        raise AssertionError("Malformed input accepted")
protocols = subprocess.check_output(["/usr/bin/ffprobe", "-v", "error", "-protocols"], text=True)
assert all(line.strip() in ("Supported file protocols:", "Input:", "Output:", "file", "pipe")
           for line in protocols.splitlines()), protocols
assert not os.path.exists("/usr/local/lib/python3.13/site-packages/pip")
try:
    open("/app/unexpected-write", "w")
except OSError:
    pass
else:
    raise AssertionError("Runtime filesystem was writable")
print("Portrait H.264/AAC accepted; malformed inputs rejected; non-root, read-only and no network protocols verified.")
'''
subprocess.run([
    "docker", "run", "--rm", "-i", "--network", "none", "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "--cpus", "1", "--memory", "256m",
    "--pids-limit", "32", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--entrypoint", "python", args.image, "-c", program,
], input=fixture.read_bytes(), timeout=60, check=True)
