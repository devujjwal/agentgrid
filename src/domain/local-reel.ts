export const LOCAL_REEL_LIMITS = {
  clips: 12,
  fileBytes: 30_000_000,
  totalBytes: 100_000_000,
  seconds: 60,
};
export type LocalClip = {
  id: string;
  name: string;
  url: string;
  kind: 'image' | 'video';
  bytes: number;
  width: number;
  height: number;
  sourceSeconds: number;
  start: number;
  seconds: number;
  caption: string;
  fit: 'cover' | 'contain';
};
export function localMediaKind(type: string): LocalClip['kind'] | null {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(type)) return 'image';
  if (['video/mp4', 'video/webm', 'video/quicktime'].includes(type)) return 'video';
  return null;
}
export function validateLocalTimeline(clips: readonly LocalClip[]) {
  if (!clips.length || clips.length > LOCAL_REEL_LIMITS.clips)
    throw Error('Choose 1–12 images or videos.');
  let total = 0;
  for (const clip of clips) {
    if (
      !clip.url.startsWith('blob:') ||
      !Number.isInteger(clip.bytes) ||
      clip.bytes < 1 ||
      clip.bytes > LOCAL_REEL_LIMITS.fileBytes ||
      !['image', 'video'].includes(clip.kind) ||
      !['cover', 'contain'].includes(clip.fit) ||
      !Number.isInteger(clip.width) ||
      clip.width < 1 ||
      !Number.isInteger(clip.height) ||
      clip.height < 1 ||
      clip.width * clip.height > 20_000_000 ||
      !Number.isFinite(clip.seconds) ||
      clip.seconds < 0.5 ||
      clip.seconds > 15 ||
      !Number.isFinite(clip.start) ||
      clip.start < 0 ||
      clip.caption.length > 120 ||
      (clip.kind === 'video' &&
        (!Number.isFinite(clip.sourceSeconds) ||
          clip.start + clip.seconds > clip.sourceSeconds + 0.01))
    )
      throw Error('Each clip needs a valid duration (0.5–15 seconds) within its source video.');
    total += clip.seconds;
  }
  if (clips.reduce((sum, clip) => sum + clip.bytes, 0) > LOCAL_REEL_LIMITS.totalBytes)
    throw Error('Keep source files within 100 MB in total.');
  if (total > LOCAL_REEL_LIMITS.seconds) throw Error('Keep the finished reel within 60 seconds.');
  return total;
}
export function framePlacement(width: number, height: number, fit: LocalClip['fit']) {
  const scale =
    fit === 'cover' ? Math.max(720 / width, 1280 / height) : Math.min(720 / width, 1280 / height);
  return {
    x: (720 - width * scale) / 2,
    y: (1280 - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  };
}
export function recordingType(supported: (mime: string) => boolean, sound: boolean) {
  const types = sound
    ? [
        'video/mp4;codecs=avc1.424028,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
    : ['video/mp4;codecs=avc1.424028', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find(supported) ?? null;
}
