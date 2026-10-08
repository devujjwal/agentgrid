import {
  ConnectionGuidePage,
  connectionMetadata,
} from '../../../components/connections/ConnectionGuidePage';
import { connectionGuides } from '../../../data/connections';
export const dynamicParams = false;
export function generateStaticParams() {
  return connectionGuides.filter((item) => item.kind === 'platform').map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return connectionMetadata('platform', (await params).slug);
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <ConnectionGuidePage kind="platform" slug={(await params).slug} />;
}
