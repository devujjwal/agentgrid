import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseConnectionGuides } from '../domain/connection-guide';
import { categoryGuides } from './categories';
const bytes = readFileSync(resolve('content/connections/guides.json'));
if (bytes.byteLength > 256_000) throw new Error('Connection guidance exceeds build bounds.');
export const connectionGuides = parseConnectionGuides(
  JSON.parse(bytes.toString('utf8')),
  categoryGuides.map((item) => item.slug),
);
