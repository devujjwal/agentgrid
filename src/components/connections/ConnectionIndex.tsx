import Link from 'next/link';
import { SiteFrame } from '../layout/SiteFrame';
import { connectionGuides } from '../../data/connections';
import { connectionPath, type ConnectionKind } from '../../domain/connection-guide';
import { connectionLabel as label } from './connection-label';
import '../../app/learn/learning.css';
import '../../app/categories/categories.css';
export function ConnectionIndex({ kind }: { kind: ConnectionKind }) {
  const items = connectionGuides.filter((item) => item.kind === kind);
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="learning-page">
        <header className="learning-header">
          <p className="eyebrow">{label(kind)} / Connection literacy</p>
          <h1>
            {kind === 'platform'
              ? 'Choose where your agent runs.'
              : kind === 'integration'
                ? 'Bring context with clear boundaries.'
                : 'Understand the tools behind the task.'}
          </h1>
          <p className="learning-summary">
            Start with the task and the access it needs. These guides explain setup choices and
            review questions. Each agent’s own page carries its platform and tool requirements.
          </p>
        </header>
        <ul className="discipline-index">
          {items.map((item, index) => (
            <li key={item.slug}>
              <span className="discipline-number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="eyebrow">Documentation guide</p>
                <h2>
                  <Link prefetch={false} href={connectionPath(item)}>
                    {item.name} ↗
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
