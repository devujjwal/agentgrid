import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibilityNote } from '../src/domain/compatibility-note.ts';

const old =
  'Instructions-based setup. Provider/model behavior must be checked against the included examples before this draft is advertised as tested. No connector or scheduler is assumed.';
test('released setup contextualizes historical authoring wording without changing the original or runtime limits', () => {
  const result = compatibilityNote(old, true);
  assert.equal(result.original, old);
  assert.match(result.current, /This version is published/);
  assert.match(result.current, /own provider and model/);
  assert.match(result.current, /No connector or scheduler is assumed/);
  assert.doesNotMatch(result.current, /before this draft is advertised as tested/);
  assert.doesNotMatch(result.current, /verified|passed/);
});
test('unpublished and unfamiliar compatibility warnings retain their complete wording', () => {
  assert.deepEqual(compatibilityNote(old, false), { current: old, original: null });
  const warning = 'This host has not been tested with file uploads. Do not share private files.';
  assert.deepEqual(compatibilityNote(warning, true), { current: warning, original: null });
});
