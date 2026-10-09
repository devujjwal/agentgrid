import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '../../components/layout/SiteFrame';
import { categoryGuides } from '../../data/categories';
import { categoryPath } from '../../domain/category';
import '../learn/learning.css';
import './categories.css';
export const metadata: Metadata = {
  title: 'Explore AI agents by the work you want to do — AgentGrid',
  description:
    'Choose a useful starting point across work, learning and everyday life. Category guides explain suitable tasks, required inputs and how to check the result.',
  alternates: { canonical: '/categories/' },
  robots: {
    index: process.env.AGENTGRID_BUILD_STAGE === 'production',
    follow: process.env.AGENTGRID_BUILD_STAGE === 'production',
  },
};
export default function CategoriesPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        <header className="learning-header">
          <p className="eyebrow">Ten disciplines / One connected library</p>
          <h1>
            Start with your world.
            <br />
            <em>Find useful work.</em>
          </h1>
          <p className="learning-summary">
            You do not need to know agent terminology. Start with a problem, bring the right
            context, and learn what a useful result should look like.
          </p>
        </header>
        <ul className="discipline-index">
          {categoryGuides.map((item, index) => (
            <li key={item.slug}>
              <span className="discipline-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="eyebrow">{item.name}</p>
                <h2>
                  <Link prefetch={false} href={categoryPath(item.slug)}>
                    {item.headline}
                    <span aria-hidden="true"> ↗</span>
                  </Link>
                </h2>
                <p>{item.summary}</p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </SiteFrame>
  );
}
