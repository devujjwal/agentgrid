import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { socialImageReferences, validateSocialImage } from '../scripts/verify-social-export.mjs';
import { socialImage } from '../src/domain/social-metadata.ts';
test('social delivery uses an actual bounded PNG and reads encoded metadata without executing markup', async () => {
  const image = await readFile('public/social/agentgrid.png');
  assert.doesNotThrow(() => validateSocialImage(image));
  for (const bytes of [Buffer.alloc(10), Buffer.alloc(300001), Buffer.from('<svg>not a PNG</svg>')])
    assert.throws(() => validateSocialImage(bytes));
  const badDimensions = Buffer.from(image);
  badDimensions.writeUInt32BE(1, 16);
  assert.throws(() => validateSocialImage(badDimensions));
  assert.deepEqual(
    socialImageReferences(
      `<meta content="${socialImage.url}" property="og:image"><meta name="twitter:image" content="https://bad.test/?a=1&amp;b=2"><script>throw new Error('not executed')</script>`,
    ),
    [socialImage.url, 'https://bad.test/?a=1&b=2'],
  );
});
