'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReelPlan } from '../../domain/reels';
export type ReelDraft = Omit<ReelPlan, 'sourceRunId'>;
const empty: ReelDraft = {
  title: '',
  narration: '',
  scenes: [{ seconds: 5, visual: '', onScreenText: '' }],
  format: 'portrait-720p',
};
export function ReelPlanner({ initial = empty }: { initial?: ReelDraft }) {
  const [draft, setDraft] = useState(initial);
  const [preview, setPreview] = useState<ReelDraft | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLHeadingElement>(null);
  const wasPreviewing = useRef(false);
  useEffect(() => {
    if (preview) previewRef.current?.focus();
    else if (wasPreviewing.current) titleRef.current?.focus();
    wasPreviewing.current = Boolean(preview);
  }, [preview]);
  const seconds = draft.scenes.reduce((total, scene) => total + scene.seconds, 0);
  function updateScene(index: number, change: Partial<ReelDraft['scenes'][number]>) {
    setDraft({
      ...draft,
      scenes: draft.scenes.map((scene, position) =>
        position === index ? { ...scene, ...change } : scene,
      ),
    });
    setPreview(null);
  }
  return (
    <>
      <p role="status">
        Generation and posting are disabled. This plan stays in this tab and is cleared when you
        leave. Nothing is sent to a provider.
      </p>
      {!preview && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPreview(structuredClone(draft));
          }}
        >
          <label htmlFor="reel-title">Reel title</label>
          <input
            ref={titleRef}
            id="reel-title"
            required
            maxLength={120}
            value={draft.title}
            onChange={(event) => {
              setDraft({ ...draft, title: event.target.value });
              setPreview(null);
            }}
          />
          <label htmlFor="reel-narration">Narration</label>
          <textarea
            id="reel-narration"
            required
            maxLength={3000}
            rows={4}
            value={draft.narration}
            onChange={(event) => {
              setDraft({ ...draft, narration: event.target.value });
              setPreview(null);
            }}
          />
          <h2>Storyboard</h2>
          <p>Portrait format · 720 × 1280 · {seconds} / 30 seconds</p>
          {draft.scenes.map((scene, index) => (
            <fieldset key={index} className="reel-scene">
              <legend>Scene {index + 1}</legend>
              <label htmlFor={`reel-visual-${index}`}>Visual direction</label>
              <textarea
                id={`reel-visual-${index}`}
                required
                maxLength={1000}
                rows={2}
                value={scene.visual}
                onChange={(event) => updateScene(index, { visual: event.target.value })}
              />
              <label htmlFor={`reel-text-${index}`}>On-screen text</label>
              <input
                id={`reel-text-${index}`}
                maxLength={200}
                value={scene.onScreenText}
                onChange={(event) => updateScene(index, { onScreenText: event.target.value })}
              />
              <label htmlFor={`reel-seconds-${index}`}>Seconds</label>
              <select
                id={`reel-seconds-${index}`}
                value={scene.seconds}
                onChange={(event) => updateScene(index, { seconds: Number(event.target.value) })}
              >
                {Array.from({ length: 10 }, (_, n) => (
                  <option key={n + 1} value={n + 1}>
                    {n + 1}
                  </option>
                ))}
              </select>
              {draft.scenes.length > 1 && (
                <button
                  type="button"
                  className="action-secondary"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      scenes: draft.scenes.filter((_, position) => position !== index),
                    });
                    setPreview(null);
                  }}
                >
                  Remove scene {index + 1}
                </button>
              )}
            </fieldset>
          ))}
          {seconds > 30 && <p role="alert">Reduce the total duration to 30 seconds or less.</p>}
          <div className="reel-actions">
            <button
              type="button"
              className="action-secondary"
              disabled={draft.scenes.length >= 6}
              onClick={() => {
                setDraft({
                  ...draft,
                  scenes: [...draft.scenes, { seconds: 5, visual: '', onScreenText: '' }],
                });
                setPreview(null);
              }}
            >
              Add scene
            </button>
            <button type="submit" className="action-primary" disabled={seconds > 30}>
              Preview plan
            </button>
          </div>
        </form>
      )}
      {preview && (
        <section aria-label="Plan preview" className="reel-preview">
          <h2 ref={previewRef} tabIndex={-1}>
            {preview.title}
          </h2>
          <p>Portrait · 720 × 1280 · {seconds} seconds</p>
          <p className="reel-script">{preview.narration}</p>
          <ol>
            {preview.scenes.map((scene, index) => (
              <li key={index}>
                <strong>{scene.seconds} seconds</strong>
                <p>{scene.visual}</p>
                {scene.onScreenText && <p>On-screen: {scene.onScreenText}</p>}
              </li>
            ))}
          </ol>
          <p>This is a storyboard preview. No video has been rendered.</p>
          <button type="button" className="action-secondary" onClick={() => setPreview(null)}>
            Edit plan
          </button>
        </section>
      )}
      <section>
        <h2>Publishing destinations</h2>
        <p>
          Instagram, Facebook and LinkedIn connections are not available yet. Publishing will
          require a finished video and your approval of each account, caption and schedule.
        </p>
      </section>
    </>
  );
}
