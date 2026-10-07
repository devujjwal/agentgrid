import { NetworkMark } from '../brand/NetworkMark';
import { IntentNetwork } from '../brand/IntentNetwork';
import { DiscoveryConsole } from '../discovery/DiscoveryConsole';
import type { DiscoveryResource } from '../../domain/discovery';

export function DesignHome({ resources }: { resources: DiscoveryResource[] }) {
  return (
    <div className="agentgrid-site" data-agentgrid-preview="local-only">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="preview-notice">
        Local design preview <span aria-hidden="true">/</span> Unpublished drafts · no verified
        platform claims
      </div>
      <header className="site-header">
        <a className="brand" href="#main-content" aria-label="AgentGrid.me home">
          <NetworkMark />
          <span>
            agentgrid<span className="brand-domain">.me</span>
          </span>
        </a>
        <nav aria-label="Primary">
          <a href="#catalogue-heading">Discover</a>
          <a href="#universe">
            Agent Universe<span aria-hidden="true">↗</span>
          </a>
          <a href="#resource-model">How it works</a>
        </nav>
        <span className="header-note">Ideas → useful work</span>
      </header>
      <main id="main-content">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-topline">
            <span className="eyebrow">The discovery & distribution network for AI agents</span>
            <span className="hero-index" aria-hidden="true">
              AG—001 / DISCOVERY
            </span>
          </div>
          <div className="hero-copy">
            <h1 id="hero-heading">
              What do you want
              <br />
              an AI agent to <em>do?</em>
            </h1>
            <p>
              Find a useful starting point.
              <br />
              Understand it. Make it your own.
            </p>
            <div className="hero-symbol" aria-hidden="true">
              <IntentNetwork />
            </div>
          </div>
          <DiscoveryConsole resources={resources} />
        </section>
        <section
          className="resource-model"
          id="resource-model"
          aria-labelledby="resource-model-heading"
        >
          <p className="eyebrow">03 / From discovery to doing</p>
          <div className="resource-model-layout">
            <h2 id="resource-model-heading">
              More than a link.
              <br />A starting point
              <br />
              <em>you can build on.</em>
            </h2>
            <div>
              <p>
                Every agent should give you the pieces to do useful work: instructions, the right
                inputs, a clear setup and honest limits.
              </p>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <h3>Understand the task</h3>
                    <p>Know what the resource does, what it needs and where its authority ends.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h3>Bring it to your platform</h3>
                    <p>
                      Follow explicit setup steps. Check the example before trusting the output.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h3>Make it fit your world</h3>
                    <p>Review the package’s reuse terms before adapting or sharing a version.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <a className="brand" href="#main-content">
          <NetworkMark />
          <span>agentgrid.me</span>
        </a>
        <p>Useful intelligence. Connected.</p>
        <span>First-party draft foundation</span>
      </footer>
    </div>
  );
}
