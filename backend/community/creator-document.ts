import { socialImage } from '../../src/domain/social-metadata.ts';
import { creatorPath, safeCreatorWebsite, type PublicCreator } from '../../src/domain/creator.ts';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
export function creatorDocument(creator: PublicCreator | null, status: number) {
  const name =
    creator?.displayName ??
    (status === 503 ? 'Connection interrupted.' : 'This signal is unavailable.');
  const path = creator ? creatorPath(creator.username) : null;
  const website = safeCreatorWebsite(creator?.website ?? null);
  const title = creator ? `${name} — AgentGrid creator` : 'Creator unavailable — AgentGrid';
  const description = creator
    ? `${name} on AgentGrid. Explore their published AI agents and reusable instructions.`
    : 'Explore useful AI agents and their creators on AgentGrid.';
  const cards =
    creator?.agents
      .map(
        (agent) =>
          `<li class="creator-agent"><div><span class="eyebrow">${escape(agent.category.replaceAll('-', ' '))}</span><span class="version">v${escape(agent.version)}</span></div><h3><a href="/agents/${escape(agent.slug)}/">${escape(agent.name)} <span aria-hidden="true">↗</span></a></h3><p>${escape(agent.summary)}</p><p class="release-date">Released <time datetime="${escape(agent.releasedAt)}">${escape(agent.releasedAt.slice(0, 10))}</time></p></li>`,
      )
      .join('') ?? '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><meta name="robots" content="noindex,follow">${path ? `<link rel="canonical" href="https://agentgrid.me${path}${creator!.offset ? `?offset=${creator!.offset}` : ''}"><meta property="og:url" content="https://agentgrid.me${path}">` : ''}<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="profile"><meta property="og:image" content="${socialImage.url}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escape(socialImage.alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${socialImage.url}"><meta name="twitter:image:alt" content="${escape(socialImage.alt)}"><link rel="icon" href="/icon.svg"><link rel="stylesheet" href="/resource-status.css"><link rel="stylesheet" href="/creator.css"></head><body><a class="skip-link" href="#main-content">Skip to main content</a><header><a class="wordmark" href="/" aria-label="AgentGrid.me home">agentgrid<span>.me</span></a><nav aria-label="Primary"><a href="/agents/">Discover</a><a href="/#universe">Agent Universe ↗</a></nav></header><main id="main-content" tabindex="-1"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">AgentGrid</a><span aria-hidden="true"> / </span><span>${creator ? 'Creator profile' : 'Resource status'}</span></nav><section class="creator-introduction"><div class="creator-signal" aria-hidden="true"><span></span><i></i><b></b></div><p class="eyebrow">${creator ? (creator.kind === 'first-party' ? 'AgentGrid Editorial / first-party resources' : 'An independent voice in the network') : `Resource status / ${status}`}</p><h1>${escape(name)}</h1>${creator ? `<p class="creator-handle">@${escape(creator.username)}</p><p class="creator-bio">${escape(creator.bio || 'This creator has not added a biography.')}</p>${website ? `<a class="creator-website" href="${escape(website)}" rel="ugc nofollow noopener noreferrer">Visit creator website <span aria-hidden="true">↗</span></a>` : ''}<p class="creator-disclosure">${creator.kind === 'first-party' ? 'Resources created and maintained by AgentGrid Editorial.' : 'Profile information is supplied by the creator. Publication is not an endorsement of their identity or external website.'}</p>` : `<p class="explanation">${status === 503 ? 'We could not load the current profile. Please try again shortly.' : 'This address has no public contributing profile. The creator may have chosen privacy, or their resources may no longer be available.'}</p><a class="return-link" href="/agents/">Explore the library ↗</a>`}</section>${creator ? `<section class="creator-work" aria-labelledby="creator-work-title"><div class="creator-section-heading"><h2 id="creator-work-title">Published contributions</h2><span>Useful work, connected.</span></div>${cards ? `<ul class="creator-agents">${cards}</ul>` : '<p>No more published contributions on this page.</p>'}<nav class="creator-pagination" aria-label="Contribution pages">${creator.offset ? `<a href="${path}${creator.offset === 20 ? '' : `?offset=${creator.offset - 20}`}">← Previous contributions</a>` : ''}${creator.hasMore && creator.offset < 9980 ? `<a href="${path}?offset=${creator.offset + 20}">More contributions →</a>` : ''}</nav></section><aside class="creator-report"><p>Something needs attention?</p><a href="/workspace/report/?creator=${escape(creator.username)}">Report a concern about this profile ↗</a></aside>` : ''}</main><footer><a href="/">agentgrid.me</a><p>Useful intelligence. Connected.</p></footer></body></html>`;
}
