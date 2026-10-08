'use client';
import type { DraftEditorial } from '../../domain/draft-editorial';
import { TextField, RepeatingFields, StringList } from './Fields';
export function GuideFields({
  value,
  change,
  sources = false,
}: {
  value: DraftEditorial;
  change: (value: DraftEditorial) => void;
  sources?: boolean;
}) {
  return sources ? (
    <>
      <RepeatingFields
        label="Factual source"
        items={value.sources}
        maximum={12}
        create={() => ({ title: '', url: '', supports: '', checked_on: '' })}
        change={(sources) => change({ ...value, sources })}
      >
        {(item, index, update) => (
          <>
            <TextField
              label={`Source ${index + 1} title`}
              value={item.title}
              change={(title) => update({ ...item, title })}
              maximum={160}
              lines={1}
            />
            <TextField
              label={`Source ${index + 1} URL`}
              value={item.url}
              change={(url) => update({ ...item, url })}
              maximum={2048}
              lines={1}
              help="Use an authoritative HTTPS page you actually checked. Links are reviewed before publication."
            />
            <TextField
              label={`Source ${index + 1} supports`}
              value={item.supports}
              change={(supports) => update({ ...item, supports })}
              maximum={600}
              help="Which claim does this page support? Explain its relevance."
            />
            <TextField
              label={`Source ${index + 1} checked date`}
              value={item.checked_on}
              change={(checked_on) => update({ ...item, checked_on })}
              maximum={10}
              lines={1}
              help="YYYY-MM-DD. Record the actual date you checked the source."
            />
          </>
        )}
      </RepeatingFields>
      <StringList
        label="Related agent path"
        values={value.related_agent_slugs}
        change={(related_agent_slugs) => change({ ...value, related_agent_slugs })}
        maximum={8}
        length={80}
      />
      <p>
        Use the path of a genuinely relevant resource, such as inbox-priority-triage. Related
        resources must be available when this guide is published.
      </p>
      <StringList
        label="Discovery phrase"
        values={value.discovery.keywords}
        change={(keywords) => change({ ...value, discovery: { ...value.discovery, keywords } })}
        maximum={30}
        length={80}
      />
      <p>
        Use phrases people would naturally search for. Avoid repeating keywords or making
        unsupported claims.
      </p>
      <StringList
        label="Capability tag"
        values={value.discovery.capability_tags}
        change={(capability_tags) =>
          change({ ...value, discovery: { ...value.discovery, capability_tags } })
        }
        maximum={8}
        length={60}
      />
      <p>Use lowercase words separated by hyphens, such as email-prioritization.</p>
    </>
  ) : (
    <>
      <TextField
        label="The problem people are searching for"
        value={value.search_intent}
        change={(search_intent) => change({ ...value, search_intent })}
        maximum={300}
        help="Describe one concrete intent. This guides discovery and editorial review."
      />
      <TextField
        label="Public overview"
        value={value.overview}
        change={(overview) => change({ ...value, overview })}
        maximum={4000}
        lines={8}
        help="Explain the task, when this agent helps, and what makes its approach useful. Add context beyond the short definition."
      />
      <StringList
        label="Audience"
        values={value.audience}
        change={(audience) => change({ ...value, audience })}
        maximum={8}
        length={240}
      />
      <StringList
        label="Workflow step"
        values={value.workflow}
        change={(workflow) => change({ ...value, workflow })}
        maximum={10}
        length={1000}
      />
      <RepeatingFields
        label="Question"
        items={value.faq}
        maximum={10}
        create={() => ({ question: '', answer: '' })}
        change={(faq) => change({ ...value, faq })}
      >
        {(item, index, update) => (
          <>
            <TextField
              label={`Question ${index + 1}`}
              value={item.question}
              change={(question) => update({ ...item, question })}
              maximum={180}
              lines={1}
            />
            <TextField
              label={`Answer ${index + 1}`}
              value={item.answer}
              change={(answer) => update({ ...item, answer })}
              maximum={1600}
              help="Give a direct, factual answer that helps someone use or evaluate this agent."
            />
          </>
        )}
      </RepeatingFields>
    </>
  );
}
