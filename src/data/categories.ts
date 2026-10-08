import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCategoryGuides } from '../domain/category';
const bytes = readFileSync(resolve('content/categories/guides.json'));
if (bytes.byteLength > 256_000) throw new Error('Category content exceeds build bounds.');
export const categoryGuides = parseCategoryGuides(JSON.parse(bytes.toString('utf8')));
