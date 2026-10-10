import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '../../components/layout/SiteFrame';
import { recipeDocuments } from '../../data/recipes';
import { recipePath } from '../../domain/recipe';
import '../learn/learning.css';
import './recipes.css';
export const metadata: Metadata = {
  title: 'Agent Recipes — guided workflows for useful work',
  description:
    'Connect a concrete problem to a sequence of agent resources, with explicit inputs, human review and handoff checkpoints.',
  alternates: { canonical: '/recipes/' },
  robots: {
    index: false,
    follow: process.env.AGENTGRID_BUILD_STAGE === 'production',
  },
};
export default async function RecipesPage() {
  const documents = await recipeDocuments();
  const preview = process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1';
  return (
    <SiteFrame localPreview={preview}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        <header className="learning-header">
          <p className="eyebrow">Agent Recipes / Connected work</p>
          <h1>
            One outcome.
            <br />
            <em>A clear path.</em>
          </h1>
          <p className="learning-summary">
            Bring the right inputs. Work through a short sequence. Review each handoff before moving
            to the next step.
          </p>
          <p className="recipe-mode">Guided by you · no background automation</p>
        </header>
        {documents.length ? (
          <section className="learning-library" aria-labelledby="recipe-library-heading">
            <h2 id="recipe-library-heading">
              {preview ? 'Recipes in editorial development.' : 'Choose the outcome you need.'}
            </h2>
            <ol>
              {documents.map(({ recipe, publication }, index) => (
                <li key={recipe.slug}>
                  <span className="eyebrow" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3>
                      <Link prefetch={false} href={recipePath(recipe.slug)}>
                        {recipe.title}
                        <span aria-hidden="true">↗</span>
                      </Link>
                    </h3>
                    <p>{recipe.summary}</p>
                    <span className="learning-template-note">
                      {recipe.steps.length} steps ·{' '}
                      {publication
                        ? 'Editorial recipe'
                        : 'Unpublished draft · workflow testing pending'}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <section className="recipe-empty">
            <h2>The reviewed recipe library is being prepared.</h2>
            <p>
              Recipes will appear here after their agent versions and complete guided workflows have
              been checked.
            </p>
            <Link prefetch={false} href="/learn/">
              Learn how to choose and test a resource ↗
            </Link>
          </section>
        )}
      </main>
    </SiteFrame>
  );
}
