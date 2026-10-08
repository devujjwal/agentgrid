import { notFound } from 'next/navigation';
import { RecoveryQa } from './RecoveryQa';
export default function RecoveryQaPage() {
  if (
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1' ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    notFound();
  return <RecoveryQa />;
}
