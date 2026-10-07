'use client';

import { useEffect, useRef, useState } from 'react';
import type { DiscoveryResource } from '../../domain/discovery';
import type { AgentUniverseProps } from './AgentUniverse';

/** Interaction loads when visible; fixed canvas dimensions keep layout stable. */
export function UniverseViewport(props: AgentUniverseProps & { resources: DiscoveryResource[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [Universe, setUniverse] = useState<React.ComponentType<AgentUniverseProps> | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const active = entry?.isIntersecting ?? false;
        setVisible(active);
        if (active)
          void import('./AgentUniverse')
            .then((module) => setUniverse(() => module.AgentUniverse))
            .catch(() => setFailed(true));
      },
      { rootMargin: '120px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="universe-viewport" ref={container} data-visible={visible}>
      {Universe ? (
        <Universe {...props} />
      ) : (
        <div className="universe-loading">
          <span className="loading-orbit" aria-hidden="true" />
          <p>
            {failed
              ? 'The map is unavailable. Explore the resource list below.'
              : 'Mapping the connections…'}
          </p>
        </div>
      )}
    </div>
  );
}
