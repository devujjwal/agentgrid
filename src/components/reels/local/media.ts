import { localMediaKind, LOCAL_REEL_LIMITS, type LocalClip } from '../../../domain/local-reel';

export function localWait<T>(promise: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      cleanup();
      reject(Error('Media operation cancelled.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Error('Media decoding timed out. Try a smaller file.'));
    }, 15000);
    signal.addEventListener('abort', cancel, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
    if (signal.aborted) cancel();
  });
}

export function mediaEvent(element: HTMLMediaElement, name: string, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      element.removeEventListener(name, success);
      element.removeEventListener('error', failure);
      signal.removeEventListener('abort', failure);
    };
    const success = () => {
      cleanup();
      resolve();
    };
    const failure = () => {
      cleanup();
      reject(Error('Media could not be decoded, or the operation was cancelled.'));
    };
    const timer = setTimeout(failure, 15000);
    element.addEventListener(name, success, { once: true });
    element.addEventListener('error', failure, { once: true });
    signal.addEventListener('abort', failure, { once: true });
    if (signal.aborted) failure();
  });
}
export function releaseVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute('src');
  video.load();
}
export async function loadVideo(url: string, signal: AbortSignal) {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = true;
  const ready = mediaEvent(video, 'loadeddata', signal);
  video.src = url;
  try {
    await ready;
    return video;
  } catch (error) {
    releaseVideo(video);
    throw error;
  }
}
export async function inspectLocalFile(
  file: File,
  url: string,
  signal: AbortSignal,
): Promise<LocalClip> {
  const kind = localMediaKind(file.type);
  if (!kind || !file.size || file.size > LOCAL_REEL_LIMITS.fileBytes)
    throw Error('Use JPEG, PNG, WebP, MP4, WebM or MOV files, up to 30 MB each.');
  let width: number,
    height: number,
    sourceSeconds = 0;
  if (kind === 'image') {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } else {
    const video = await loadVideo(url, signal);
    width = video.videoWidth;
    height = video.videoHeight;
    sourceSeconds = video.duration;
    releaseVideo(video);
    if (!Number.isFinite(sourceSeconds) || sourceSeconds < 0.5)
      throw Error('This video needs a finite duration of at least half a second.');
  }
  if (signal.aborted) throw Error('Media selection cancelled.');
  if (width < 1 || height < 1 || width * height > 20_000_000)
    throw Error('Choose media with a resolution of 20 megapixels or less.');
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url,
    kind,
    bytes: file.size,
    width,
    height,
    sourceSeconds,
    start: 0,
    seconds: kind === 'video' ? Math.min(5, sourceSeconds) : 3,
    caption: '',
    fit: 'cover',
  };
}
