import { HttpFailure } from '../http/guard.ts';

export function databaseFailure(error: { code: string }): never {
  if (error.code === '23505') throw new HttpFailure(409, 'conflict');
  if (error.code === '40001') throw new HttpFailure(409, 'conflict');
  if (error.code === 'P0001') throw new HttpFailure(429, 'rate-limited');
  if (error.code === '42501') throw new HttpFailure(403, 'request-refused');
  if (error.code === '23514' || error.code === '22P02')
    throw new HttpFailure(400, 'invalid-request');
  throw new HttpFailure(503, 'service-unavailable');
}
