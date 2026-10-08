import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { learningGuides } from '../../../data/learning';
import { learningPath, learningStructuredData } from '../../../domain/learning';
import { serializeStructuredData } from '../../../domain/public-resource';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import '../learning.css';
export const dynamicParams = false;
export const generateStaticParams = () => learningGuides.map(({ slug }) => ({ slug }));
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = learningGuides.find((item) => item.slug === slug);
  if (!guide) notFound();
  return {
    title: `${guide.title} — AgentGrid`,
    description: guide.summary,
    alternates: { canonical: learningPath(slug) },
    robots: { index: false, follow: false },
    openGraph: {
      type: 'article',
      title: guide.title,
      description: guide.summary,
      url: learningPath(slug),
      modifiedTime: guide.updated,
    },
    twitter: { card: 'summary', title: guide.title, description: guide.summary },
  };
}
export default async function LearningPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = learningGuides.find((item) => item.slug === slug);
  if (!guide) notFound();
  const minutes = Math.ceil(
    guide.sections
      .flatMap((section) => section.paragraphs)
      .join(' ')
      .split(/\s+/).length / 180,
  );
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData(learningStructuredData(guide)),
          }}
        />
        <nav aria-label="Breadcrumb" className="learning-breadcrumb">
          <Link prefetch={false} href="/">
            AgentGrid
          </Link>
          <span aria-hidden="true">/</span>
          <Link prefetch={false} href="/learn/">
            Learn
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{guide.title}</span>
        </nav>
        <header className="learning-header">
          <p className="eyebrow">Field notes / Working with agents</p>
          <h1>{guide.title}</h1>
          <p className="learning-summary">{guide.summary}</p>
          <div className="learning-byline">
            <span>AgentGrid Editorial</span>
            <span>
              Updated <time dateTime={guide.updated}>{guide.updated}</time>
            </span>
            <span>About {minutes} min read</span>
          </div>
        </header>
        <div className="learning-layout">
          <nav aria-label="In this guide" className="learning-toc">
            <p className="eyebrow">In this guide</p>
            <ol>
              {guide.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
            <a href="#worksheet">Your working template ↗</a>
          </nav>
          <article className="learning-body" aria-label={guide.title}>
            {guide.sections.map((section, index) => (
              <section key={section.id} id={section.id}>
                <p className="eyebrow">{String(index + 1).padStart(2, '0')} / Field note</p>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
                {section.sourceIds?.map((id) => {
                  const source = guide.sources.find((entry) => entry.id === id)!;
                  return (
                    <p className="learning-citation" key={id}>
                      Source:{' '}
                      <a href={source.url} rel="noopener noreferrer">
                        {source.title}
                      </a>
                    </p>
                  );
                })}
              </section>
            ))}
            <section id="worksheet" className="learning-worksheet">
              <p className="eyebrow">Keep this with your task</p>
              <h2>{guide.worksheet.title}</h2>
              <p>
                Select and copy this template into your own notes. Keep sensitive task data in a
                location you control.
              </p>
              <textarea
                aria-label={guide.worksheet.title}
                id="working-template"
                readOnly
                rows={9}
                defaultValue={guide.worksheet.text}
                spellCheck={false}
              />
            </section>
            {guide.sources.length > 0 && (
              <section id="sources" className="learning-sources">
                <h2>Sources checked</h2>
                <ul>
                  {guide.sources.map((source) => (
                    <li key={source.id}>
                      <a href={source.url} rel="noopener noreferrer">
                        {source.title}
                      </a>
                      <span>
                        Checked <time dateTime={source.checked}>{source.checked}</time>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <nav id="related" className="learning-related" aria-label="Continue learning">
              <h2>Take the next step.</h2>
              {guide.related.map((slug) => {
                const related = learningGuides.find((item) => item.slug === slug)!;
                return (
                  <Link key={slug} prefetch={false} href={learningPath(slug)}>
                    {related.title}
                    <span aria-hidden="true">↗</span>
                  </Link>
                );
              })}
              <Link prefetch={false} href="/agents/">
                Explore the agent library<span aria-hidden="true">↗</span>
              </Link>
            </nav>
          </article>
        </div>
      </main>
    </SiteFrame>
  );
}
