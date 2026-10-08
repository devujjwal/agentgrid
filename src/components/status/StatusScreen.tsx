/* eslint-disable @next/next/no-html-link-for-pages -- Recovery links must load a fresh document independently of a failing client router. */
import { NetworkMark } from '../brand/NetworkMark';
/** Never render raw exception text, stack traces, request URLs or user inputs. */
export function StatusScreen({ kind, retry }: { kind: 'missing' | 'error'; retry?: () => void }) {
  return (
    <div className="status-screen">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="status-header">
        <a className="brand" href="/" aria-label="AgentGrid.me home">
          <NetworkMark />
          <span>
            agentgrid<span className="brand-domain">.me</span>
          </span>
        </a>
        <span className="eyebrow">The useful intelligence network</span>
      </header>
      <main id="main-content" tabIndex={-1}>
        <div className="status-signal" aria-hidden="true">
          <svg viewBox="0 0 240 100">
            <path d="M20 50H88M152 50H220" />
            <circle cx="20" cy="50" r="5" />
            <circle cx="220" cy="50" r="5" />
            <circle className="status-orbit" cx="120" cy="50" r="28" />
            <path d="M110 40l20 20m0-20l-20 20" />
          </svg>
        </div>
        <p className="eyebrow">
          {kind === 'missing' ? '404 / Connection not found' : 'Page interrupted / Recovery'}
        </p>
        <h1 id="status-heading" tabIndex={-1}>
          {kind === 'missing'
            ? 'This page could not be found.'
            : 'This page could not finish loading.'}
        </h1>
        <p>
          {kind === 'missing'
            ? 'The address may have changed, or this resource may not be published. You can explore the library or return to the beginning.'
            : 'Try loading the page again. If you were submitting a change, check its recorded status before repeating the submission.'}
        </p>
        <div className="status-actions">
          {retry && (
            <button type="button" onClick={retry}>
              Try loading again <span aria-hidden="true">↻</span>
            </button>
          )}
          <a href="/agents/">
            Explore the library <span aria-hidden="true">↗</span>
          </a>
          <a href="/">
            Return home <span aria-hidden="true">↗</span>
          </a>
        </div>
        <aside className="status-help">
          <p>New to agent resources?</p>
          <a href="/learn/">
            Read the practical field guide <span aria-hidden="true">↗</span>
          </a>
        </aside>
      </main>
      <footer>Useful intelligence. Connected.</footer>
    </div>
  );
}
