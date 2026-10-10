"""Private decoder sidecar. Bind behind authenticated TLS; never expose a public port."""
import hmac
import json
import os
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAXIMUM = 50_000_000
SLOTS = threading.BoundedSemaphore(2)

def decode_video(data, binary="/usr/bin/ffprobe"):
    if len(data) < 12 or len(data) > MAXIMUM or data[4:8] != b"ftyp":
        raise ValueError("Unsupported video")
    with tempfile.TemporaryDirectory(prefix="agentgrid-probe-") as directory:
        path = os.path.join(directory, "input.mp4")
        with open(path, "wb") as output:
            output.write(data)
        # Fixed argument vector and local input; disable all network protocols.
        result = subprocess.run(
            [binary, "-v", "error", "-protocol_whitelist", "file,pipe",
             "-show_entries", "stream=codec_type,codec_name,width,height:format=duration",
             "-of", "json", path],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=20, check=True,
        )
        if len(result.stdout) > 100_000:
            raise ValueError("Invalid probe output")
        payload = json.loads(result.stdout)
        videos = [s for s in payload["streams"] if s.get("codec_type") == "video"]
        audio = [s for s in payload["streams"] if s.get("codec_type") == "audio"]
        if len(videos) != 1 or len(audio) > 1:
            raise ValueError("Unsupported streams")
        return {"width": videos[0]["width"], "height": videos[0]["height"],
                "seconds": float(payload["format"]["duration"]),
                "videoCodec": videos[0]["codec_name"],
                "audioCodec": audio[0]["codec_name"] if audio else None}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Never log request bodies, credentials or video content.

    def do_POST(self):
        secret = os.environ.get("AGENTGRID_PROBE_KEY", "")
        if len(secret) < 32 or not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + secret):
            self.send_error(403)
            return
        if self.path != "/inspect" or self.headers.get("Content-Type") != "video/mp4":
            self.send_error(400)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 12 or size > MAXIMUM or not SLOTS.acquire(blocking=False):
                self.send_error(413)
                return
            try:
                self.connection.settimeout(25)
                data = self.rfile.read(size)
                if len(data) != size:
                    raise ValueError("Incomplete input")
                result = decode_video(data)
                body = json.dumps(result, allow_nan=False).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
            finally:
                SLOTS.release()
        except (ValueError, KeyError, subprocess.SubprocessError, OSError):
            self.send_error(422)

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
