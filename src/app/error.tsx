'use client';
import { useEffect } from 'react';
import { StatusScreen } from '../components/status/StatusScreen';
import './status.css';
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Page interrupted — AgentGrid';
    document.getElementById('status-heading')?.focus();
    return () => {
      document.title = previousTitle;
    };
  }, []);
  return (
    <>
      <StatusScreen kind="error" retry={retry} />
    </>
  );
}
