import type { Metadata } from 'next';
import { StatusScreen } from '../components/status/StatusScreen';
import './status.css';
export const metadata: Metadata = {
  title: 'Page not found — AgentGrid',
  robots: { index: false, follow: false },
};
export default function NotFound() {
  return <StatusScreen kind="missing" />;
}
