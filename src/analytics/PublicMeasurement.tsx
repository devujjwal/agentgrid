'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { measure } from './client';
import type { AnalyticsEvent } from '../domain/analytics';
const pages: Record<string, Extract<AnalyticsEvent, { event: 'page_view' }>['page']> = {
  '/': 'home',
  '/agents/': 'agents',
  '/recipes/': 'recipes',
  '/categories/': 'categories',
  '/learn/': 'learn',
  '/platforms/': 'platforms',
  '/integrations/': 'integrations',
  '/mcp/': 'mcp',
};
export function PublicMeasurement() {
  const pathname = usePathname();
  useEffect(() => {
    const page = pages[pathname];
    if (!page) return;
    const timer = setTimeout(() => measure({ event: 'page_view', page }), 500);
    return () => clearTimeout(timer);
  }, [pathname]);
  return null;
}
