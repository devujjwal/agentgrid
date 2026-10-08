import { socialImage } from '../../../domain/social-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { categoryGuides } from '../../../data/categories';
import { discoveryResources } from '../../../data/resources';
import { recipeDiscovery } from '../../../data/recipes';
import { categoryPath } from '../../../domain/category';
import { serializeStructuredData } from '../../../domain/public-resource';
import '../../learn/learning.css';
import '../categories.css';
export const dynamicParams = false;
export function generateStaticParams() {
  return categoryGuides.map(({ slug }) => ({ slug }));
}
const find = (slug: string) => categoryGuides.find((item) => item.slug === slug) ?? notFound();
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const item = find((await params).slug);
  return {
    title: `${item.name} AI agents — ${item.headline}`,
    description: item.summary,
    alternates: { canonical: categoryPath(item.slug) },
    robots: { index: false, follow: false },
    openGraph: {
      images: [socialImage],
      type: 'website',
      title: `${item.name} — AgentGrid`,
      description: item.summary,
      url: categoryPath(item.slug),
    },
    twitter: {
      card: 'summary_large_image',
      images: [socialImage],
      title: `${item.name} — AgentGrid`,
      description: item.summary,
    },
  };
}
export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const item = find((await params).slug);
  const resources = [...discoveryResources(), ...(await recipeDiscovery())].filter(
    (resource) => resource.category === item.slug,
  );
  const preview = process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1';
  return (
    <SiteFrame localPreview={preview}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeStructuredData({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'AgentGrid',
                  item: 'https://agentgrid.me/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Categories',
                  item: 'https://agentgrid.me/categories/',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: item.name,
                  item: `https://agentgrid.me${categoryPath(item.slug)}`,
                },
              ],
            }),
          }}
        />
        <nav aria-label="Breadcrumb" className="learning-breadcrumb">
          <Link prefetch={false} href="/">
            AgentGrid
          </Link>
          <span aria-hidden="true">/</span>
          <Link prefetch={false} href="/categories/">
            Categories
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{item.name}</span>
        </nav>
        <header className="learning-header">
          <p className="eyebrow">{item.name} / Choosing a starting point</p>
          <h1>{item.headline}</h1>
          <p className="learning-summary">{item.summary}</p>
          <div className="learning-byline">
            <span>AgentGrid Editorial</span>
            <span>
              Updated <time dateTime={item.updated}>{item.updated}</time>
            </span>
            <span>Category guide</span>
          </div>
        </header>
        <div className="learning-layout">
          <nav aria-label="On this page" className="learning-toc">
            <p className="eyebrow">Follow the signal</p>
            <ol>
              <li>
                <a href="#choose">Choose the task</a>
              </li>
              <li>
                <a href="#prepare">Prepare your inputs</a>
              </li>
              <li>
                <a href="#check">Check the result</a>
              </li>
              <li>
                <a href="#resources">Explore resources</a>
              </li>
            </ol>
          </nav>
          <article className="learning-body">
            <section id="choose">
              <h2>Choose a task you can check.</h2>
              <p>{item.overview}</p>
              <div className="discipline-choices">
                {item.choices.map((choice, index) => (
                  <div key={choice.title}>
                    <span className="eyebrow">Path {String(index + 1).padStart(2, '0')}</span>
                    <h3>{choice.title}</h3>
                    <p>{choice.body}</p>
                  </div>
                ))}
              </div>
            </section>
            <section id="prepare">
              <h2>Bring these inputs.</h2>
              <ul className="discipline-inputs">
                {item.inputs.map((input) => (
                  <li key={input}>{input}</li>
                ))}
              </ul>
            </section>
            <section id="check">
              <h2>Know what good looks like.</h2>
              <p>{item.check}</p>
              <div className="discipline-stop">
                <h3>When to pause</h3>
                <p>{item.stop}</p>
              </div>
            </section>
            <section id="resources">
              <p className="eyebrow">Connected resources</p>
              <h2>{preview ? 'Explore the editorial drafts.' : 'Find a starting point.'}</h2>
              {preview && (
                <p>
                  These instruction packages and recipes remain unpublished. Host testing, reuse
                  terms and complete workflow review are required before distribution.
                </p>
              )}
              {resources.length ? (
                <ul className="discipline-resources">
                  {resources.map((resource) => (
                    <li key={resource.slug}>
                      <span className="eyebrow">
                        {resource.kind === 'recipe' ? 'Guided recipe' : 'Instruction package'} ·{' '}
                        {resource.state === 'draft' ? 'Unpublished draft' : 'Published'}
                      </span>
                      <h3>
                        <Link prefetch={false} href={resource.href}>
                          {resource.title}
                          <span aria-hidden="true"> ↗</span>
                        </Link>
                      </h3>
                      <p>{resource.summary}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No reviewed resources have been published in this discipline yet. The guidance
                  above can help you evaluate a candidate before trusting its output.
                </p>
              )}
            </section>
            <section>
              <h2>Keep exploring.</h2>
              <nav aria-label="Related categories" className="learning-related">
                {item.related.map((slug) => {
                  const related = find(slug);
                  return (
                    <Link key={slug} prefetch={false} href={categoryPath(slug)}>
                      {related.name}
                      <span aria-hidden="true">↗</span>
                    </Link>
                  );
                })}
                <Link prefetch={false} href="/learn/using-agent-instructions/">
                  Check your first run<span aria-hidden="true">↗</span>
                </Link>
              </nav>
            </section>
          </article>
        </div>
      </main>
    </SiteFrame>
  );
}
