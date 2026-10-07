const glyphs: Record<string, string> = {
  marketing: 'M-8 6V-6l16 3v6ZM-4 7v4',
  productivity: 'M-9-7H9V7H-9ZM-9-7l9 8 9-8',
  research: 'M-6-8v16M6-8v16M-9-4h18M-9 4h18',
  education: 'M0-5-10-9v15l10 4 10-4V-9ZM0-5v15',
  content: 'M-6 8 7-5 3-9-10 4ZM-10 4-11 9-6 8',
  ecommerce: 'M-9-4H9L7 9H-7ZM-4-4v-2a4 4 0 0 1 8 0v2',
  'business-operations': 'M-9-8h18v16H-9ZM-5-3l2 2 4-5M-5 4h9',
  everyday: 'M-9-1h18M-7-1a7 7 0 0 0 14 0M-4-9v4M1-10v5M6-8v3',
  seo: 'M-9 8V3M-3 8V-2M3 8V-6M9 8V-10',
  development: 'M-5-7-11 0-5 7M5-7l6 7-6 7M2-10-2 10',
};

export function AgentGlyph({ category }: { category: string }) {
  return <path className="node-glyph" d={glyphs[category] ?? 'M-7 0h14M0-7v14'} />;
}
