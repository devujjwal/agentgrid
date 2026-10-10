import { recordingType, validateLocalTimeline, type LocalClip } from '../../../domain/local-reel';
import { drawLocalFrame } from './draw';
import { loadVideo, mediaEvent, releaseVideo, localWait } from './media';

/** Real-time device-only composition. No fetch, storage, credentials or provider ports. */
export async function composeLocalReel(options: {
  canvas: HTMLCanvasElement;
  clips: readonly LocalClip[];
  sound: boolean;
  record: boolean;
  signal: AbortSignal;
  onProgress: (seconds: number) => void;
}): Promise<Blob | null> {
  const total = validateLocalTimeline(options.clips);
  const context = options.canvas.getContext('2d', { alpha: false });
  if (!context) throw Error('This browser cannot draw the reel.');
  const hasAudio = options.sound && options.clips.some((c) => c.kind === 'video');
  let audio: AudioContext | undefined,
    stream: MediaStream | undefined,
    recorder: MediaRecorder | undefined;
  let video: HTMLVideoElement | undefined, image: HTMLImageElement | undefined;
  let audioNode: MediaElementAudioSourceNode | undefined, failure: Error | undefined;
  let recorded: Promise<Blob> | undefined,
    elapsed = 0,
    outputBytes = 0;
  const chunks: Blob[] = [];
  let optionsAudioDestination: MediaStreamAudioDestinationNode | undefined;
  let silence: ConstantSourceNode | undefined;
  const checkpoint = () => {
    if (options.signal.aborted) throw Error('Reel creation cancelled.');
    if (document.hidden) throw Error('Keep this tab visible while creating your reel.');
    if (failure) throw failure;
  };
  try {
    if (hasAudio) {
      if (typeof AudioContext === 'undefined')
        throw Error(
          'Video sound is unavailable in this browser. Turn off “Keep video sound” to continue.',
        );
      audio = new AudioContext();
      // Called directly from the user's button gesture, before media decoding.
      await localWait(audio.resume(), options.signal);
      if (audio.state !== 'running')
        throw Error('Sound could not start. Try again or turn off video sound.');
    }
    if (options.record) {
      if (
        typeof MediaRecorder === 'undefined' ||
        typeof options.canvas.captureStream !== 'function'
      )
        throw Error(
          'Video export is unavailable in this browser. Try a current Chrome, Edge or Safari browser.',
        );
      const mimeType = recordingType((type) => MediaRecorder.isTypeSupported(type), hasAudio);
      if (!mimeType) throw Error('This browser has no supported MP4 or WebM recorder.');
      stream = options.canvas.captureStream(24);
      const destination = audio?.createMediaStreamDestination();
      if (destination && audio) {
        // A continuously active zero-valued source preserves audio timestamps
        // across image clips and silent gaps between source videos.
        silence = audio.createConstantSource();
        silence.offset.value = 0;
        silence.connect(destination);
        silence.start();
        for (const track of destination.stream.getAudioTracks()) stream.addTrack(track);
      }
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      recorded = new Promise<Blob>((resolve, reject) => {
        recorder!.ondataavailable = (event) => {
          if (!event.data.size) return;
          outputBytes += event.data.size;
          if (outputBytes > 30_000_000)
            failure = Error('Export exceeded 30 MB. Use a shorter reel.');
          else chunks.push(event.data);
        };
        recorder!.onerror = () => {
          failure = Error('The browser recorder failed. Try a shorter reel.');
          reject(failure);
        };
        recorder!.onstop = () => {
          if (failure || options.signal.aborted)
            reject(failure ?? Error('Reel creation cancelled.'));
          else if (!chunks.length) reject(Error('The browser produced an empty video.'));
          else resolve(new Blob(chunks, { type: recorder!.mimeType }));
        };
      });
      void recorded.catch(() => undefined);
      // Connect each video only to the recorded stream, without playing it through speakers.
      if (destination) optionsAudioDestination = destination;
    }
    for (const clip of options.clips) {
      checkpoint();
      if (recorder?.state === 'recording') recorder.pause();
      let source: CanvasImageSource;
      if (clip.kind === 'video') {
        video = await loadVideo(clip.url, options.signal);
        if (clip.start > 0) {
          const seek = mediaEvent(video, 'seeked', options.signal);
          video.currentTime = clip.start;
          await seek;
        }
        if (audio) {
          video.muted = false;
          audioNode = audio.createMediaElementSource(video);
          audioNode.connect(optionsAudioDestination ?? audio.destination);
        }
        source = video;
      } else {
        image = new Image();
        image.src = clip.url;
        await localWait(image.decode(), options.signal);
        source = image;
      }
      checkpoint();
      drawLocalFrame(context, source, clip);
      if (video) await localWait(video.play(), options.signal);
      if (recorder?.state === 'inactive') recorder.start(1000);
      else if (recorder?.state === 'paused') recorder.resume();
      const started = performance.now();
      await new Promise<void>((resolve, reject) => {
        let frame = 0;
        const cancelled = () => {
          cancelAnimationFrame(frame);
          options.signal.removeEventListener('abort', cancelled);
          reject(Error('Reel creation cancelled.'));
        };
        const paint = () => {
          try {
            checkpoint();
            const seconds = Math.min(clip.seconds, (performance.now() - started) / 1000);
            if (video && seconds > 0.5 && video.currentTime < clip.start + seconds - 0.5)
              throw Error('Video playback stalled. Try a shorter or smaller source video.');
            drawLocalFrame(context, source, clip);
            options.onProgress(elapsed + seconds);
            if (seconds >= clip.seconds) {
              options.signal.removeEventListener('abort', cancelled);
              resolve();
            } else frame = requestAnimationFrame(paint);
          } catch (error) {
            options.signal.removeEventListener('abort', cancelled);
            reject(error);
          }
        };
        options.signal.addEventListener('abort', cancelled, { once: true });
        frame = requestAnimationFrame(paint);
      });
      elapsed += clip.seconds;
      if (video) {
        audioNode?.disconnect();
        audioNode = undefined;
        releaseVideo(video);
        video = undefined;
      }
      if (image) {
        image.removeAttribute('src');
        image = undefined;
      }
    }
    checkpoint();
    options.onProgress(total);
    if (recorder && recorded) {
      recorder.stop();
      return await localWait(recorded, options.signal);
    }
    return null;
  } finally {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    audioNode?.disconnect();
    silence?.stop();
    silence?.disconnect();
    if (video) releaseVideo(video);
    if (image) image.removeAttribute('src');
    await audio?.close();
  }
}
