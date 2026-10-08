import { socialImage } from '../../domain/social-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '../../components/layout/SiteFrame';
import { learningGuides } from '../../data/learning';
import { learningPath } from '../../domain/learning';
import './learning.css';
export const metadata: Metadata = {
  title: 'Learn to choose and use AI agents — AgentGrid',
  description:
    'Practical guides for choosing an agent, checking a first run and keeping permissions separate from source material. Includes reusable working templates.',
  alternates: { canonical: '/learn/' },
  robots: { index: false, follow: false },
  openGraph: {
    images: [socialImage],
    title: 'A field guide to useful AI agents',
    description: 'Choose with purpose. Test with evidence. Keep control of the action.',
    url: '/learn/',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    images: [socialImage],
    title: 'A field guide to useful AI agents',
    description: 'Practical guides and working templates from AgentGrid.',
  },
};
export default function LearnPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        <header className="learning-header learning-index-header">
          <p className="eyebrow">The field guide / AgentGrid Editorial</p>
          <h1>
            From possibility
            <br />
            to <em>useful work.</em>
          </h1>
          <p className="learning-summary">
            You do not need to know agent terminology to start. Define a task, try a small example,
            and keep control of what happens next.
          </p>
          <ol className="learning-route" aria-label="Learning path">
            <li>Choose</li>
            <li>Try</li>
            <li>Review</li>
          </ol>
        </header>
        <section aria-labelledby="learning-library-heading" className="learning-library">
          <h2 id="learning-library-heading">Start with a practical question.</h2>
          <ol>
            {learningGuides.map((guide, index) => (
              <li key={guide.slug}>
                <span className="eyebrow" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>
                    <Link prefetch={false} href={learningPath(guide.slug)}>
                      {guide.title}
                      <span aria-hidden="true">↗</span>
                    </Link>
                  </h3>
                  <p>{guide.summary}</p>
                  <span className="learning-template-note">Includes a working template</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="learning-boundary">
          <p className="eyebrow">One useful distinction</p>
          <h2>
            Instructions describe the work.
            <br />
            Your platform runs it.
          </h2>
          <p>
            A package of instructions does not automatically connect an account, schedule a job or
            authorize an action. Read each resource’s setup and limits before you begin.
          </p>
          <Link prefetch={false} href="/agents/">
            Explore agent resources ↗
          </Link>
        </aside>
      </main>
    </SiteFrame>
  );
}
