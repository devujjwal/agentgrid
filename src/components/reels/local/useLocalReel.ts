'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { LOCAL_REEL_LIMITS, localMediaKind, type LocalClip } from '../../../domain/local-reel';
import { inspectLocalFile } from './media';
import { composeLocalReel } from './compose';

export function useLocalReel(canvas: RefObject<HTMLCanvasElement | null>) {
  const [clips, setClips] = useState<LocalClip[]>([]);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState<'loading' | 'preview' | 'export' | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [output, setOutput] = useState<{ url: string; extension: string; bytes: number } | null>(
    null,
  );
  const job = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const urls = useRef(new Set<string>());
  const outputUrl = useRef<string | null>(null);
  function revoke(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }
  function clearOutput() {
    if (outputUrl.current) revoke(outputUrl.current);
    outputUrl.current = null;
    setOutput(null);
  }
  useEffect(() => {
    mounted.current = true;
    const owned = urls.current;
    const hidden = () => {
      if (document.hidden) job.current?.abort();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      mounted.current = false;
      job.current?.abort();
      document.removeEventListener('visibilitychange', hidden);
      owned.forEach((url) => URL.revokeObjectURL(url));
      owned.clear();
    };
  }, []);
  async function add(files: File[]) {
    if (busy || !files.length) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy('loading');
    setError('');
    clearOutput();
    const pending: string[] = [];
    try {
      if (
        files.length + clips.length > LOCAL_REEL_LIMITS.clips ||
        files.reduce((n, file) => n + file.size, 0) + clips.reduce((n, clip) => n + clip.bytes, 0) >
          LOCAL_REEL_LIMITS.totalBytes
      )
        throw Error('Choose up to 12 clips and 100 MB of source files in total.');
      const added: LocalClip[] = [];
      for (const file of files) {
        if (!localMediaKind(file.type) || !file.size || file.size > LOCAL_REEL_LIMITS.fileBytes)
          throw Error('Use JPEG, PNG, WebP, MP4, WebM or MOV files, up to 30 MB each.');
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        pending.push(url);
        added.push(await inspectLocalFile(file, url, controller.signal));
      }
      if (!mounted.current || controller.signal.aborted) throw Error('Media selection cancelled.');
      setClips((current) => [...current, ...added]);
      pending.length = 0;
    } catch (failure) {
      if (mounted.current)
        setError(failure instanceof Error ? failure.message : 'This media could not be opened.');
    } finally {
      pending.forEach(revoke);
      job.current = null;
      if (mounted.current) setBusy(null);
    }
  }
  function update(id: string, patch: Partial<LocalClip>) {
    if (busy) return;
    clearOutput();
    setError('');
    setClips((current) => current.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip)));
  }
  function remove(id: string) {
    if (busy) return;
    const clip = clips.find((item) => item.id === id);
    if (clip) revoke(clip.url);
    clearOutput();
    setClips((current) => current.filter((item) => item.id !== id));
  }
  function move(index: number, direction: number) {
    if (busy || index + direction < 0 || index + direction >= clips.length) return;
    clearOutput();
    setClips((current) => {
      const result = [...current];
      const item = result.splice(index, 1)[0]!;
      result.splice(index + direction, 0, item);
      return result;
    });
  }
  async function run(record: boolean) {
    if (busy || !canvas.current) return;
    const controller = new AbortController();
    job.current = controller;
    setBusy(record ? 'export' : 'preview');
    setError('');
    setProgress(0);
    clearOutput();
    try {
      const blob = await composeLocalReel({
        canvas: canvas.current,
        clips,
        sound,
        record,
        signal: controller.signal,
        onProgress: (seconds) => {
          if (mounted.current) setProgress(seconds);
        },
      });
      if (blob && mounted.current && !controller.signal.aborted) {
        const url = URL.createObjectURL(blob);
        urls.current.add(url);
        outputUrl.current = url;
        setOutput({
          url,
          extension: blob.type.startsWith('video/mp4') ? 'mp4' : 'webm',
          bytes: blob.size,
        });
      }
    } catch (failure) {
      if (mounted.current)
        setError(failure instanceof Error ? failure.message : 'Reel creation failed.');
    } finally {
      job.current = null;
      if (mounted.current) setBusy(null);
    }
  }
  function changeSound(value: boolean) {
    if (!busy) {
      clearOutput();
      setSound(value);
    }
  }
  function clear() {
    if (!busy) {
      clearOutput();
      clips.forEach((clip) => revoke(clip.url));
      setClips([]);
      setError('');
      setProgress(0);
    }
  }
  return {
    clips,
    sound,
    busy,
    progress,
    error,
    output,
    add,
    update,
    remove,
    move,
    run,
    changeSound,
    clear,
    cancel: () => job.current?.abort(),
  };
}
