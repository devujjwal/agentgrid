import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DiscoveryConsole } from '../../../../components/discovery/DiscoveryConsole';
import { SiteFrame } from '../../../../components/layout/SiteFrame';
import { discoveryResources } from '../../../../data/resources';
import { directoryPages, directoryPagePath } from '../../../../domain/directory-pagination';
import { publicationRobots } from '../../../../domain/search-indexing';
import { socialImage } from '../../../../domain/social-metadata';

export const dynamicParams = false;
export function generateStaticParams() {
  const pages = directoryPages(discoveryResources().length);
  return pages.length
    ? pages.map((page) => ({ page: String(page) }))
    : [{ page: '__agentgrid_unpublished__' }];
}
function findPage(value: string) {
  const page = Number(value);
  if (String(page) !== value || !directoryPages(discoveryResources().length).includes(page))
    notFound();
  return page;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const page = findPage((await params).page);
  const title = `Published AI agents — page ${page} — AgentGrid`;
  const description = `Continue browsing AgentGrid’s published AI agent catalogue on page ${page}. Read each agent’s purpose, inputs, platform requirements and limits.`;
  return {
    title,
    description,
    alternates: { canonical: directoryPagePath(page) },
    robots: publicationRobots(process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1'),
    openGraph: {
      type: 'website',
      title,
      description,
      url: directoryPagePath(page),
      images: [socialImage],
    },
    twitter: { card: 'summary_large_image', title, description, images: [socialImage] },
  };
}
export default async function DirectoryPage({ params }: { params: Promise<{ page: string }> }) {
  const page = findPage((await params).page);
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="agent-directory">
        <header className="directory-heading">
          <p className="eyebrow">The useful intelligence network / Catalogue page {page}</p>
          <h1>Published agents — page {page}</h1>
          <p>
            Continue exploring the library. Read each resource’s requirements and limits before
            using it.
          </p>
          <Link className="directory-category-link" prefetch={false} href="/categories/">
            Explore category guides ↗
          </Link>
        </header>
        <DiscoveryConsole
          key={page}
          resources={discoveryResources()}
          initialPage={page - 1}
          directoryPagination
        />
      </main>
    </SiteFrame>
  );
}
