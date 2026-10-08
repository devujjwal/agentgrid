import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { recipeDocuments } from '../../../data/recipes';
import { resourceDocuments } from '../../../data/resources';
import { recipePath } from '../../../domain/recipe';
import { serializeStructuredData } from '../../../domain/public-resource';
import '../../learn/learning.css';
import '../recipes.css';
export const dynamicParams = false;
export async function generateStaticParams() {
  const documents = await recipeDocuments();
  return documents.length
    ? documents.map(({ recipe }) => ({ slug: recipe.slug }))
    : [{ slug: '__agentgrid_unpublished__' }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = (await recipeDocuments()).find(({ recipe }) => recipe.slug === slug);
  if (!document) notFound();
  return {
    title: `${document.recipe.title} — AgentGrid Recipe`,
    description: document.recipe.summary,
    alternates: { canonical: recipePath(slug) },
    robots: { index: Boolean(document.publication), follow: Boolean(document.publication) },
    openGraph: {
      type: 'article',
      title: document.recipe.title,
      description: document.recipe.summary,
      url: recipePath(slug),
    },
    twitter: {
      card: 'summary',
      title: document.recipe.title,
      description: document.recipe.summary,
    },
  };
}
export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = (await recipeDocuments()).find(({ recipe }) => recipe.slug === slug);
  if (!document) notFound();
  const { recipe, publication } = document;
  const resources = resourceDocuments();
  const url = `https://agentgrid.me${recipePath(slug)}`;
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        {publication && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeStructuredData({
                '@context': 'https://schema.org',
                '@graph': [
                  {
                    '@type': 'Article',
                    headline: recipe.title,
                    description: recipe.summary,
                    url,
                    datePublished: publication.released_at,
                    dateModified: publication.released_at,
                    author: { '@type': 'Organization', name: 'AgentGrid Editorial' },
                  },
                  {
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
                        name: 'Recipes',
                        item: 'https://agentgrid.me/recipes/',
                      },
                      { '@type': 'ListItem', position: 3, name: recipe.title, item: url },
                    ],
                  },
                ],
              }),
            }}
          />
        )}
        <nav aria-label="Breadcrumb" className="learning-breadcrumb">
          <Link prefetch={false} href="/">
            AgentGrid
          </Link>
          <span aria-hidden="true">/</span>
          <Link prefetch={false} href="/recipes/">
            Recipes
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{recipe.title}</span>
        </nav>
        <header className="learning-header">
          <p className="eyebrow">{recipe.category.replaceAll('-', ' ')} / Guided recipe</p>
          <h1>{recipe.title}</h1>
          <p className="learning-summary">{recipe.summary}</p>
          <div className="learning-byline">
            <span>AgentGrid Editorial{publication ? '' : ' draft'}</span>
            <span>Recipe version {recipe.version}</span>
            <span>{recipe.steps.length} human review checkpoints</span>
          </div>
          {!publication && (
            <p className="recipe-draft">Unpublished recipe · complete workflow testing pending</p>
          )}
        </header>
        <div className="recipe-layout">
          <aside className="recipe-preparation">
            <p className="eyebrow">Before you begin</p>
            <h2>Bring the right inputs.</h2>
            <ul>
              {recipe.inputs.map((input) => (
                <li key={input}>{input}</li>
              ))}
            </ul>
            <h2>Your intended outcome</h2>
            <p>{recipe.outcome}</p>
            <a href="#step-1">
              Start with step 1 <span aria-hidden="true">↓</span>
            </a>
          </aside>
          <article className="learning-body" aria-label={recipe.title}>
            <section>
              <h2>How this sequence helps.</h2>
              <p>{recipe.overview}</p>
              <p className="recipe-mode">
                You transfer each checked output into the next step. Open the linked resource to
                confirm its current availability, setup and reuse terms before starting.
              </p>
            </section>
            <ol className="recipe-steps">
              {recipe.steps.map((step, index) => {
                const resource = resources.find(
                  ({ specification }) => specification.identity.slug === step.agent_slug,
                );
                return (
                  <li key={`${step.agent_slug}-${index}`} id={`step-${index + 1}`}>
                    <span className="recipe-step-number" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <section>
                      <p className="eyebrow">Step {index + 1} / Guided handoff</p>
                      <h2>{step.title}</h2>
                      <Link
                        prefetch={false}
                        className="recipe-agent"
                        href={`/agents/${step.agent_slug}/`}
                      >
                        <strong>{resource?.specification.identity.name ?? step.agent_slug}</strong>
                        <span>Agent version {step.agent_version} ↗</span>
                      </Link>
                      <h3>Give it this context</h3>
                      <p>{step.send}</p>
                      <h3>Check before moving on</h3>
                      <p>{step.check}</p>
                      <div className="recipe-handoff">
                        <h3>
                          {index === recipe.steps.length - 1
                            ? 'Finish with a human decision'
                            : 'Carry forward'}
                        </h3>
                        <p>{step.handoff}</p>
                      </div>
                    </section>
                  </li>
                );
              })}
            </ol>
            <section className="recipe-checkpoint">
              <p className="eyebrow">When to stop and clarify</p>
              <h2>Keep the unresolved part visible.</h2>
              <p>{recipe.checkpoint}</p>
            </section>
            <section>
              <h2>A small example to reason through.</h2>
              <p className="recipe-example-note">
                Illustrative input and expected behavior. This is not an observed host-run
                transcript.
              </p>
              <h3>Example input</h3>
              <p>{recipe.example.input}</p>
              <h3>Expected distinction</h3>
              <p>{recipe.example.expected}</p>
            </section>
            <section>
              <h2>Limits and costs</h2>
              <ul className="recipe-limits">
                {recipe.limitations.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </section>
            <nav className="learning-related" aria-label="Continue exploring">
              <Link prefetch={false} href="/recipes/">
                Explore other recipes<span aria-hidden="true">↗</span>
              </Link>
              <Link prefetch={false} href="/learn/using-agent-instructions/">
                How to check an instruction-package run<span aria-hidden="true">↗</span>
              </Link>
            </nav>
          </article>
        </div>
      </main>
    </SiteFrame>
  );
}
