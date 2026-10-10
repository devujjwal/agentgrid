'use client';
import { useId, useRef, useSyncExternalStore } from 'react';
import { validateLocalTimeline } from '../../../domain/local-reel';
import { useLocalReel } from './useLocalReel';
import { LocalClipList } from './LocalClipList';
const subscribe = () => () => {};
function localMediaPolicy() {
  const policy = document.getElementById('agentgrid-csp')?.getAttribute('content');
  return (
    !policy ||
    (policy.includes("media-src 'self' blob:") && policy.includes("img-src 'self' data: blob:"))
  );
}
export function LocalReelEditor() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const editor = useLocalReel(canvas);
  const inputId = useId();
  const policyReady = useSyncExternalStore(subscribe, localMediaPolicy, () => true);
  const total = editor.clips.reduce(
    (sum, clip) => sum + (Number.isFinite(clip.seconds) ? clip.seconds : 0),
    0,
  );
  let validation = '';
  if (editor.clips.length) {
    try {
      validateLocalTimeline(editor.clips);
    } catch (error) {
      validation = error instanceof Error ? error.message : 'Check the timeline.';
    }
  }
  if (!policyReady)
    return (
      <section data-agentgrid-local-reels="1">
        <h2>Create a reel on your device</h2>
        <p>Open the editor to load its local-media settings.</p>
        <a href="/workspace/reels/">Open browser reel editor</a>
      </section>
    );
  return (
    <section
      className="local-reel-editor"
      data-agentgrid-local-reels="1"
      aria-labelledby={`${inputId}-heading`}
    >
      <div className="local-reel-heading">
        <h2 id={`${inputId}-heading`}>Create a reel on your device</h2>
        <span className="local-reel-badge">Free · no uploads</span>
      </div>
      <p>
        Turn your own images and videos into a portrait reel. Your files stay in this tab. No
        sign-in, cloud generation or social connection is needed.
      </p>
      <div className="media-notice">
        <p>
          Download your finished video before leaving. Refreshing or closing this page clears the
          project. Nothing is posted automatically.
        </p>
      </div>
      <div className="local-reel-layout">
        <div>
          <div className="local-reel-picker">
            <label htmlFor={inputId}>Choose your images and videos</label>
            <input
              id={inputId}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              disabled={!!editor.busy}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = '';
                void editor.add(files);
              }}
              aria-describedby={`${inputId}-help`}
            />
            <p className="media-help" id={`${inputId}-help`}>
              JPEG, PNG, WebP, MP4, WebM or MOV. Up to 12 clips, 30 MB per file, 100 MB total. Use
              media you have permission to share.
            </p>
          </div>
          {!editor.clips.length && (
            <p className="local-reel-empty">
              Choose a few moments to begin. Arrange them below, then preview your reel.
            </p>
          )}
          <LocalClipList
            clips={editor.clips}
            busy={!!editor.busy}
            update={editor.update}
            remove={editor.remove}
            move={editor.move}
          />
        </div>
        <div className="local-reel-monitor">
          <h3>Portrait preview</h3>
          <canvas
            ref={canvas}
            width={720}
            height={1280}
            className="local-reel-canvas"
            aria-label="Reel preview, 720 by 1280 pixels"
          />
          <p className="media-help">
            720 × 1280 · up to 60 seconds · {total.toFixed(1)} seconds in your timeline
          </p>
          <label className="media-check">
            <input
              type="checkbox"
              checked={editor.sound}
              disabled={!!editor.busy}
              onChange={(event) => editor.changeSound(event.target.checked)}
            />
            Keep original video sound
          </label>
          <p className="media-help">
            {editor.sound
              ? 'Video clips retain their own audio; image clips are silent.'
              : 'Your exported reel will be silent.'}
          </p>
          <div className="reel-actions">
            <button
              type="button"
              disabled={!!editor.busy || !editor.clips.length || !!validation}
              onClick={() => void editor.run(false)}
            >
              Play preview
            </button>
            <button
              type="button"
              disabled={!!editor.busy || !editor.clips.length || !!validation}
              onClick={() => void editor.run(true)}
            >
              Create downloadable reel
            </button>
            {editor.busy ? (
              <button type="button" onClick={editor.cancel}>
                Cancel
              </button>
            ) : (
              <button type="button" disabled={!editor.clips.length} onClick={editor.clear}>
                Clear project
              </button>
            )}
          </div>
          <p className="media-help">
            Creation takes about the length of your reel. Keep this tab visible. Your browser
            chooses a supported MP4 or WebM format.
          </p>
          {editor.busy && (
            <div role="status">
              <p>
                {editor.busy === 'loading'
                  ? 'Opening your media…'
                  : `${editor.busy === 'export' ? 'Creating your download' : 'Playing preview'}: ${editor.progress.toFixed(1)} seconds`}
              </p>
              <progress
                max={Math.max(total, 1)}
                value={editor.progress}
                aria-label="Reel creation progress"
              />
            </div>
          )}
          {(editor.error || validation) && <p role="alert">{editor.error || validation}</p>}
          {editor.output && (
            <section className="local-reel-output" aria-label="Finished reel">
              <h3>Your reel is ready</h3>
              <video
                className="reel-video"
                src={editor.output.url}
                controls
                playsInline
                preload="metadata"
                aria-label="Finished reel playback"
              />
              <p>
                {editor.output.extension.toUpperCase()} ·{' '}
                {(editor.output.bytes / 1_000_000).toFixed(1)} MB
              </p>
              <a
                className="local-reel-download"
                href={editor.output.url}
                download={`agentgrid-reel.${editor.output.extension}`}
              >
                Download reel
              </a>
              <p className="media-help">
                Watch it through before sharing. This file is stored only on your device.
              </p>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
