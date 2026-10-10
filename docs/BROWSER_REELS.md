# Browser reel creation

The free editor at `/workspace/reels/` combines users’ own raster images and video clips on their device. It works without sign-in and without the execution service. It does not upload, persist or send media to a provider. The existing Pages static host serves its code; no additional hosting service, subscription or renderer is provisioned.

Users can arrange clips, trim video, choose cropped or contained portrait framing, add captions, preview and download. Export is real-time at 720 × 1280, up to 60 seconds. Limits: 12 clips, 30 MB per source file, 100 MB total, 20 megapixels per source, 0.5–15 seconds per clip. Supported inputs are JPEG/PNG/WebP and browser-decodable MP4/WebM/MOV; container acceptance does not promise every codec. Original video sound is optional and off initially. Image segments are silent. Browser MediaRecorder chooses supported MP4 or WebM; users should inspect the downloaded file before manually sharing it.

The project and blob URLs live only in this tab. Editing invalidates an earlier export. Cancel, hidden tab or unmount stops composition and releases tracks/decoded sources. Removal and teardown revoke owned URLs. Export and decoding have resource bounds and useful errors. Refresh loses the project; download before leaving. No AI generation, narration, music library, cloud archive or automatic publishing is included.

All five execution, reel-generation, social OAuth, publishing and scheduler flags remain zero, and site/member budgets remain zero. Local composition has no execution, queue, storage or provider dependency. Do not activate those services or enroll in paid hosting to use this editor.

Static CSP allows image and media blob URLs only on documents carrying the local editor marker. Script and connection authority remain unchanged. Workspace entry links load a fresh document. If a Next client navigation retains another page’s CSP, the editor prompts for a normal full navigation before accepting media.

## Acceptance evidence — 10 October 2026

Chrome, optimized and hardened local export, synthetic owned fixtures:

- Image + video with caption and contain framing: silent H.264 MP4, 720 × 1280, 4.027133 seconds for a 4-second timeline, 66,820 bytes; no audio stream.
- Reordered and trimmed video (start 0.25, duration 0.5 seconds) + image, original sound enabled: H.264/AAC MP4, 720 × 1280, 3.525100 seconds for 3.5 seconds, 109,137 bytes, 48 kHz audio.
- Downloaded files inspected using the existing FFprobe image with network disabled, read-only filesystem and resource caps.
- Editing removed the previous download; invalid source trim disabled creation; cancel released controls and produced no download.
- No horizontal overflow at 320, 768, 1024 and 1440 CSS pixels. Anonymous workspace editor accepted the local image with the hardened CSP.
- Other browsers and WebM export are not independently verified. No paid calls or live posts were made.

Reproduce with `pnpm design:build`, `pnpm design:preview`, and `/qa/reels/` or `/workspace/reels/`. Fixtures are `tests/fixtures/local-reel-image.png` (synthetic gradient) and `video-probe-portrait.mp4` (synthetic video). The QA route is local-only and forbidden in deployment artifacts. Domain and static policy cases run in `pnpm check`.
