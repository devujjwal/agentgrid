import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localMediaKind,
  validateLocalTimeline,
  framePlacement,
  recordingType,
} from '../src/domain/local-reel.ts';
const clip = (patch = {}) => ({
  id: 'local',
  name: 'sample.png',
  url: 'blob:https://agentgrid.me/local',
  kind: 'image',
  bytes: 1024,
  width: 1200,
  height: 800,
  sourceSeconds: 0,
  start: 0,
  seconds: 3,
  caption: '',
  fit: 'cover',
  ...patch,
});
test('local timeline accepts bounded images and source-trimmed video', () => {
  assert.equal(
    validateLocalTimeline([
      clip(),
      clip({ kind: 'video', sourceSeconds: 8, start: 2, seconds: 5 }),
    ]),
    8,
  );
  assert.equal(validateLocalTimeline(Array.from({ length: 4 }, () => clip({ seconds: 15 }))), 60);
});
test('local timeline rejects invalid media, trims, durations and excessive resource use', () => {
  assert.throws(() => validateLocalTimeline([]));
  assert.throws(() => validateLocalTimeline(Array.from({ length: 13 }, () => clip())));
  for (const patch of [
    { url: 'https://example.com/image.png' },
    { seconds: NaN },
    { seconds: Infinity },
    { seconds: 0 },
    { seconds: 16 },
    { start: -1 },
    { width: 0 },
    { height: 0.5 },
    { width: 10000, height: 10000 },
    { bytes: 0 },
    { bytes: 30000001 },
    { caption: 'x'.repeat(121) },
    { kind: 'video', sourceSeconds: NaN },
    { kind: 'video', sourceSeconds: 3, start: 1, seconds: 3 },
  ]) {
    assert.throws(() => validateLocalTimeline([clip(patch)]));
  }
  assert.throws(() =>
    validateLocalTimeline(Array.from({ length: 5 }, () => clip({ seconds: 15 }))),
  );
  assert.throws(() =>
    validateLocalTimeline(Array.from({ length: 4 }, () => clip({ bytes: 30000000 }))),
  );
});
test('only raster images and supported video containers can be selected', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp'])
    assert.equal(localMediaKind(type), 'image');
  for (const type of ['video/mp4', 'video/webm', 'video/quicktime'])
    assert.equal(localMediaKind(type), 'video');
  for (const type of ['image/svg+xml', 'text/html', 'application/javascript', ''])
    assert.equal(localMediaKind(type), null);
});
test('portrait framing crops or letterboxes with centered geometry', () => {
  assert.deepEqual(framePlacement(720, 1280, 'cover'), { x: 0, y: 0, width: 720, height: 1280 });
  const cover = framePlacement(1280, 720, 'cover'),
    contain = framePlacement(1280, 720, 'contain');
  assert.equal(cover.height, 1280);
  assert.ok(cover.x < 0);
  assert.equal(cover.y, 0);
  assert.equal(contain.width, 720);
  assert.equal(contain.x, 0);
  assert.ok(contain.y > 0);
});
test('recording chooses a supported local format, including audio and unsupported cases', () => {
  assert.equal(
    recordingType((type) => type === 'video/mp4', false),
    'video/mp4',
  );
  assert.equal(
    recordingType((type) => type === 'video/webm;codecs=vp8,opus', true),
    'video/webm;codecs=vp8,opus',
  );
  assert.equal(
    recordingType(() => false, true),
    null,
  );
});
