import type { LocalClip } from '../../../domain/local-reel';
export function LocalClipList({
  clips,
  busy,
  update,
  remove,
  move,
}: {
  clips: LocalClip[];
  busy: boolean;
  update: (id: string, patch: Partial<LocalClip>) => void;
  remove: (id: string) => void;
  move: (index: number, direction: number) => void;
}) {
  return (
    <ol className="local-reel-clips">
      {clips.map((clip, index) => (
        <li key={clip.id} className="local-reel-clip">
          <div className="local-reel-clip-heading">
            <h3>Clip {index + 1}</h3>
            <span>{clip.kind === 'video' ? 'Video' : 'Image'}</span>
          </div>
          <p className="local-reel-filename">{clip.name}</p>
          <fieldset disabled={busy}>
            <legend className="sr-only">Settings for clip {index + 1}</legend>
            <div className="local-reel-timing">
              <label>
                Duration (seconds)
                <input
                  type="number"
                  min="0.5"
                  max="15"
                  step="0.1"
                  value={Number.isFinite(clip.seconds) ? clip.seconds : ''}
                  onChange={(event) => update(clip.id, { seconds: event.target.valueAsNumber })}
                />
              </label>
              {clip.kind === 'video' && (
                <label>
                  Start in source (seconds)
                  <input
                    type="number"
                    min="0"
                    max={clip.sourceSeconds - 0.5}
                    step="0.1"
                    value={Number.isFinite(clip.start) ? clip.start : ''}
                    onChange={(event) => update(clip.id, { start: event.target.valueAsNumber })}
                  />
                </label>
              )}
            </div>
            {clip.kind === 'video' && (
              <p className="media-help">Source length: {clip.sourceSeconds.toFixed(1)} seconds.</p>
            )}
            <label>
              Portrait framing
              <select
                value={clip.fit}
                onChange={(event) =>
                  update(clip.id, { fit: event.target.value as LocalClip['fit'] })
                }
              >
                <option value="cover">Fill frame (crop edges)</option>
                <option value="contain">Show whole image or video</option>
              </select>
            </label>
            <label>
              On-screen caption
              <textarea
                rows={2}
                maxLength={120}
                value={clip.caption}
                placeholder="Add a short caption"
                onChange={(event) => update(clip.id, { caption: event.target.value })}
              />
            </label>
            <div className="reel-actions">
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Move clip ${index + 1} earlier`}
                onClick={() => move(index, -1)}
              >
                Earlier
              </button>
              <button
                type="button"
                disabled={index === clips.length - 1}
                aria-label={`Move clip ${index + 1} later`}
                onClick={() => move(index, 1)}
              >
                Later
              </button>
              <button
                type="button"
                aria-label={`Remove clip ${index + 1}`}
                onClick={() => remove(clip.id)}
              >
                Remove
              </button>
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}
