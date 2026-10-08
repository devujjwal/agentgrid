/** Synthetic values for isolated acceptance; never publication input. */
export const creatorFixture = {
  id: '10000000-0000-4000-8000-000000000003',
  username: 'synthetic_creator',
  displayName: 'Synthetic creator',
  kind: 'community',
  website: 'https://example.test/',
  bio: 'This is a synthetic creator profile for local acceptance only. These disposable examples test live privacy, reporting, readable typography and published contribution layouts. They do not represent a real creator or actual community activity.',
  agents: [
    {
      id: '20000000-0000-4000-8000-000000000003',
      slug: 'weekly-meal-planner',
      name: 'Synthetic meal planning resource',
      summary:
        'A disposable contribution used to inspect a useful everyday workflow, clear setup expectations and accessible discovery.',
      category: 'everyday',
      version: '1.0.0',
      releasedAt: '2026-10-07T00:00:00Z',
    },
    {
      id: '20000000-0000-4000-8000-000000000004',
      slug: 'retrieval-study-coach',
      name: 'Synthetic study planning resource',
      summary:
        'A disposable education contribution used to test creator listings. This is not a published or host-tested AgentGrid package.',
      category: 'education',
      version: '1.0.0',
      releasedAt: '2026-10-06T00:00:00Z',
    },
  ],
};
