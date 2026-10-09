/** Local operator command. No credential discovery, telemetry activation or public counters. */
import { z } from 'zod';
import { publicCommunityConfiguration } from '../backend/community/configuration.ts';
import { readJsonBody } from '../backend/http/guard.ts';
const rows = z
  .array(
    z.strictObject({
      day: z.iso.date(),
      event: z.enum([
        'page_view',
        'search',
        'agent_view',
        'copy_instructions',
        'platform_select',
        'definition_download',
      ]),
      count: z.int().min(1).max(2000),
    }),
  )
  .max(180);
try {
  const action = process.argv[2];
  if (
    process.argv.length !== 3 ||
    !['report', 'prune'].includes(action) ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    throw new Error('Local operator action required.');
  const config = publicCommunityConfiguration(process.env);
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key))
    throw new Error('Server credential unavailable.');
  const response = await fetch(
    config.supabaseOrigin +
      '/rest/v1/rpc/' +
      (action === 'report' ? 'agentgrid_analytics_summary' : 'agentgrid_analytics_prune'),
    {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: '{}',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error('Analytics operation unavailable.');
  if (action === 'prune') {
    await response.body?.cancel();
    console.log(
      'Expired aggregate rows pruned. No current observations or application resources changed.',
    );
  } else {
    // Streaming byte bound applies before parsing. Reports display event totals,
    // never individual resource dimensions or provider responses.
    const data = rows.parse(
      await readJsonBody(
        new Request('https://agentgrid.me/internal-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: response.body,
          duplex: 'half',
        }),
        100000,
      ),
    );
    const totals = {};
    for (const row of data) totals[row.event] = (totals[row.event] ?? 0) + row.count;
    console.log(
      JSON.stringify(
        {
          window: 'last 30 UTC calendar dates',
          measurement:
            'Approximate accepted observations; not unique people, successful installs or popularity.',
          totals,
        },
        null,
        2,
      ),
    );
  }
} catch {
  console.error(
    'Analytics operation did not complete. Check explicit server configuration and migration availability. No credentials or provider details logged.',
  );
  process.exitCode = 1;
}
