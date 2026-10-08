import {
  ConnectionGuidePage,
  connectionMetadata,
} from '../../../components/connections/ConnectionGuidePage';
import { connectionGuides } from '../../../data/connections';
export const dynamicParams = false;
export function generateStaticParams() {
  return connectionGuides
    .filter((item) => item.kind === 'integration')
    .map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return connectionMetadata('integration', (await params).slug);
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ConnectionGuidePage kind="integration" slug={(await params).slug} />;
}
