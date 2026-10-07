/** Display names only; a label does not grant compatibility or account access. */
const names: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  codex: 'Codex',
  cursor: 'Cursor',
  n8n: 'n8n',
};
export function platformLabel(slug: string): string {
  return names[slug] ?? slug;
}
