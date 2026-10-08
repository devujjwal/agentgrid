import { z } from 'zod';
import { EditorialSchema } from './editorial.ts';
import { parseDraftEditorial, type DraftEditorial } from './draft-editorial.ts';
const guidance: Record<string, string> = {
  search_intent: 'Search intent: describe the problem in 40–300 characters.',
  overview: 'Public overview: add 240–4,000 characters of useful context.',
  audience: 'Audience: add 2–8 descriptions, each 24–240 characters.',
  workflow: 'Workflow: add 3–10 practical steps, each 60–1,000 characters.',
  faq: 'Questions: add 3–10 distinct questions (12–180 characters) with factual answers (80–1,600 characters).',
  sources:
    'Sources: add at least one authoritative HTTPS source, its title, the claim it supports and the date you checked it.',
  related_agent_slugs:
    'Related agents: add 2–8 relevant lowercase resource paths separated with hyphens.',
  discovery:
    'Discovery: add 3–30 natural search phrases and 1–8 lowercase capability tags separated with hyphens.',
  reviewed_on: 'Guide checked date: enter the actual review date as YYYY-MM-DD.',
  review:
    'Readiness declarations: complete each check and confirm only what you actually reviewed.',
};
export function guideReadinessIssues(value: DraftEditorial, now = new Date()): string[] {
  const issues = new Set<string>();
  try {
    parseDraftEditorial(value);
  } catch (error) {
    if (error instanceof z.ZodError)
      for (const issue of error.issues)
        issues.add(guidance[String(issue.path[0])] ?? 'Check the guide document fields.');
    else
      issues.add(
        error instanceof Error ? error.message : 'The guide exceeds safe document bounds.',
      );
  }
  const parsed = EditorialSchema.safeParse(value);
  if (!parsed.success)
    for (const issue of parsed.error.issues)
      issues.add(guidance[String(issue.path[0])] ?? 'Check the guide document fields.');
  if (value.discovery.keywords.length < 3 || !value.discovery.capability_tags.length)
    issues.add(guidance.discovery!);
  if (new Set(value.related_agent_slugs).size !== value.related_agent_slugs.length)
    issues.add('Related agents: use distinct resource paths.');
  if (
    new Set(value.faq.map((item) => item.question.trim().toLowerCase())).size !== value.faq.length
  )
    issues.add('Questions: remove duplicates so each answer serves a different need.');
  const current = (date: string) => {
    const time = Date.parse(date + 'T00:00:00Z');
    return Number.isFinite(time) && time <= now.getTime() && time >= now.getTime() - 90 * 86400000;
  };
  if (value.reviewed_on && !current(value.reviewed_on))
    issues.add('Guide review must be within the last 90 days and cannot be future-dated.');
  if (value.sources.some((source) => source.checked_on && !current(source.checked_on)))
    issues.add('Source checks must be within the last 90 days and cannot be future-dated.');
  return [...issues];
}
