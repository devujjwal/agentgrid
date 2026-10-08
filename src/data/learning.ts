import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseLearningGuides } from '../domain/learning';
const bytes = readFileSync(resolve('content/learning/guides.json'));
if (bytes.byteLength > 256_000) throw new Error('Learning content exceeds build bounds.');
/** Reviewed repository content only; never renders arbitrary Markdown or HTML. */
export const learningGuides = parseLearningGuides(JSON.parse(bytes.toString('utf8')));
