import { socialImage } from '../../../domain/social-metadata';
import { publicationRobots } from '../../../domain/search-indexing';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { resourceDocuments } from '../../../data/resources';
import { resourcePath } from '../../../domain/public-resource';
import { ResourceDetail } from '../../../components/resource/ResourceDetail';

export const dynamicParams = false;
export function generateStaticParams() {
  const resources = resourceDocuments();
  // Next 16 export requires a nonempty params list. This invalid, reserved slug
  // always calls notFound below and must not produce an exported resource file.
  // It is not a placeholder agent, catalogue entry or sitemap URL.
  return resources.length
    ? resources.map((document) => ({ slug: document.specification.identity.slug }))
    : [{ slug: '__agentgrid_unpublished__' }];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = resourceDocuments().find((item) => item.specification.identity.slug === slug);
  if (!document) notFound();
  const spec = document.specification;
  return {
    title: `${spec.identity.name} — AgentGrid`,
    description: spec.identity.summary,
    alternates: { canonical: resourcePath(slug) },
    robots: publicationRobots(Boolean(document.publication)),
    openGraph: {
      images: [socialImage],
      type: 'website',
      title: spec.identity.name,
      description: spec.identity.summary,
      url: resourcePath(slug),
    },
    twitter: {
      card: 'summary_large_image',
      images: [socialImage],
      title: spec.identity.name,
      description: spec.identity.summary,
    },
  };
}
export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const documents = resourceDocuments();
  const document = documents.find((item) => item.specification.identity.slug === slug);
  if (!document) notFound();
  const relatedSlugs = new Set(document.publication?.editorial.related_agent_slugs ?? []);
  return (
    <ResourceDetail
      document={document}
      related={documents.filter((item) => relatedSlugs.has(item.specification.identity.slug))}
    />
  );
}
