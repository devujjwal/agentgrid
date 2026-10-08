/** Deterministic brand asset. No content, network fetches, private metadata or runtime service. */
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';
import { mkdir, writeFile } from 'node:fs/promises';
const ink = '#173c33',
  paper = '#f7f6f0',
  signal = '#bd5d34';
const svg = h(
  'svg',
  {
    width: 490,
    height: 490,
    viewBox: '0 0 490 490',
    style: { position: 'absolute', right: -28, top: 70 },
  },
  h(
    'g',
    { stroke: ink, strokeWidth: 1.5, fill: 'none' },
    h('circle', { cx: 245, cy: 245, r: 190, strokeOpacity: 0.18 }),
    h('circle', { cx: 245, cy: 245, r: 120, strokeOpacity: 0.24 }),
    h('path', { d: 'M55 245H435M245 55V435M111 111L379 379M379 111L111 379', strokeOpacity: 0.2 }),
    h('path', {
      d: 'M111 111L245 245L379 111M245 245L435 245M245 245L245 435M111 379L245 245',
      strokeOpacity: 0.75,
    }),
  ),
  ...[
    [111, 111],
    [379, 111],
    [435, 245],
    [245, 435],
    [111, 379],
  ].map(([cx, cy]) =>
    h(
      'g',
      { key: cx + ',' + cy },
      h('circle', { cx, cy, r: 15, fill: paper, stroke: ink, strokeWidth: 2 }),
      h('circle', { cx, cy, r: 4, fill: ink }),
    ),
  ),
  h('circle', { cx: 245, cy: 245, r: 36, fill: ink }),
  h('path', { d: 'M229 245H261M245 229V261', stroke: paper, strokeWidth: 2 }),
  h('circle', { cx: 304, cy: 186, r: 7, fill: signal }),
);
const response = new ImageResponse(
  h(
    'div',
    {
      style: {
        display: 'flex',
        width: '100%',
        height: '100%',
        background: paper,
        color: ink,
        fontFamily: 'sans-serif',
        position: 'relative',
        padding: '52px 64px',
        flexDirection: 'column',
      },
    },
    h(
      'div',
      { style: { display: 'flex', fontSize: 31, fontWeight: 700, letterSpacing: -1 } },
      'agentgrid.me',
    ),
    h('div', {
      style: {
        position: 'absolute',
        left: 64,
        right: 64,
        top: 110,
        height: 1,
        background: '#c8d0c8',
      },
    }),
    h(
      'div',
      { style: { display: 'flex', fontSize: 17, letterSpacing: 3, marginTop: 57 } },
      'USEFUL INTELLIGENCE. CONNECTED.',
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          fontSize: 70,
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: -3,
          marginTop: 24,
        },
      },
      h('span', null, 'Find an agent.'),
      h('span', null, 'Make it useful.'),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          fontSize: 23,
          lineHeight: 1.4,
          marginTop: 28,
          flexDirection: 'column',
        },
      },
      h('span', null, 'Discover AI agents for work,'),
      h('span', null, 'learning and everyday life.'),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          position: 'absolute',
          left: 64,
          bottom: 44,
          fontSize: 16,
          letterSpacing: 2,
        },
      },
      'DISCOVER  /  UNDERSTAND  /  USE',
    ),
    svg,
  ),
  { width: 1200, height: 630 },
);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.byteLength > 300_000 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a')
  throw new Error('Unexpected social image output.');
await mkdir('public/social', { recursive: true });
await writeFile('public/social/agentgrid.png', bytes);
console.log(`Generated 1200 × 630 brand image (${bytes.byteLength} bytes).`);
