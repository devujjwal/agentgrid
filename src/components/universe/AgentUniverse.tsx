'use client';

import { useState, useSyncExternalStore } from 'react';
import type { DiscoveryResource } from '../../domain/discovery';
import { type UniverseRelation, layoutUniverse } from './model';
import { AgentGlyph } from './AgentGlyph';

export interface AgentUniverseProps {
  resources: readonly DiscoveryResource[];
  relations: readonly UniverseRelation[];
  matchedSlugs: readonly string[];
  selectedSlug: string;
  onSelect: (slug: string, focusDetails?: boolean) => void;
}

function subscribeCompact(update: () => void) {
  const media = window.matchMedia('(max-width: 767px)');
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}
const compactSnapshot = () => window.matchMedia('(max-width: 767px)').matches;
const serverSnapshot = () => false;

export function AgentUniverse({
  resources,
  relations,
  matchedSlugs,
  selectedSlug,
  onSelect,
}: AgentUniverseProps) {
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, serverSnapshot);
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = hovered ?? selectedSlug;
  const model = layoutUniverse(resources, relations, matchedSlugs, selectedSlug, compact);
  const nodeBySlug = new Map(model.nodes.map((node) => [node.resource.slug, node]));
  const currentIndex = matchedSlugs.indexOf(selectedSlug);
  function advance(direction: number) {
    const slug =
      matchedSlugs[(currentIndex + direction + matchedSlugs.length) % matchedSlugs.length];
    if (slug) onSelect(slug, false);
  }
  if (!matchedSlugs.length)
    return (
      <div className="universe-loading">
        <p>No nodes match this task.</p>
        <p>Try another task or discipline above.</p>
      </div>
    );
  return (
    <>
      <svg
        className="agent-universe"
        viewBox={compact ? '0 0 360 440' : '0 0 660 550'}
        role="group"
        aria-label="Agent Universe: select a resource to inspect its capabilities"
      >
        <defs>
          <pattern id="universe-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.65" fill="currentColor" />
          </pattern>
        </defs>
        <rect
          className="universe-grid"
          width="660"
          height="550"
          fill="url(#universe-grid)"
          aria-hidden="true"
        />
        <g className="universe-coordinates" aria-hidden="true">
          <path
            d={
              compact
                ? 'M20 30h14m-7-7v14M326 30h14m-7-7v14'
                : 'M24 36h14m-7-7v14M622 36h14m-7-7v14M24 514h14m-7-7v14M622 514h14m-7-7v14'
            }
          />
          <text x="24" y="20">
            {compact ? 'FOCUS / SHARED CAPABILITIES' : 'AG / TASK NETWORK'}
          </text>
        </g>
        <g aria-hidden="true">
          {model.edges.map((edge) => {
            const from = nodeBySlug.get(edge.source);
            const to = nodeBySlug.get(edge.target);
            if (!from || !to) return null;
            const active =
              (edge.source === focus || edge.target === focus) && from.matched && to.matched;
            return (
              <g
                key={`${edge.source}:${edge.target}`}
                className={`network-edge ${active ? 'is-connected' : ''}`}
              >
                <title>{edge.capability}</title>
                <path
                  d={`M${from.x},${from.y} Q${(from.x + to.x) / 2 + 24},${(from.y + to.y) / 2 - 32} ${to.x},${to.y}`}
                />
                {active && (
                  <circle
                    className="edge-junction"
                    cx={(from.x + to.x) / 2 + 12}
                    cy={(from.y + to.y) / 2 - 16}
                    r="3"
                  />
                )}
              </g>
            );
          })}
        </g>
        {model.nodes.map(({ resource, x, y, label, labelLines, matched, related }) => {
          const selected = resource.slug === selectedSlug;
          return (
            <g
              key={resource.slug}
              transform={`translate(${x} ${y})`}
              className={`network-node ${selected ? 'is-selected' : ''} ${matched ? 'is-match' : 'is-muted'} ${related ? 'is-related' : ''}`}
            >
              <a
                href="#resource-inspector"
                tabIndex={matched ? 0 : -1}
                aria-label={`${label} ${resource.category.replaceAll('-', ' ')} — Inspect ${resource.title}, ${resource.state === 'editorial' ? 'editorial guide' : resource.state === 'draft' ? 'unpublished draft' : 'published resource'}`}
                aria-current={selected ? 'true' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(resource.slug);
                }}
                onMouseEnter={() => setHovered(resource.slug)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(resource.slug)}
                onBlur={() => setHovered(null)}
              >
                <circle className="node-hit-area" r={compact ? 32 : 27} />
                {selected && <circle className="node-selection-wave" r="24" />}
                <circle className="node-outer" r="20" />
                <circle className="node-ring" r="13" />
                <AgentGlyph category={resource.category} />
                <text className="node-name" y="43" textAnchor="middle">
                  {labelLines.map((line, index) => (
                    <tspan key={index} x="0" dy={index ? 17 : 0}>
                      {line}
                    </tspan>
                  ))}
                </text>
                <text
                  className="node-category"
                  y={labelLines.length > 1 ? 78 : 61}
                  textAnchor="middle"
                >
                  {resource.category === 'seo' ? 'SEO' : resource.category.replaceAll('-', ' ')}
                </text>
              </a>
            </g>
          );
        })}
      </svg>
      {
        <div className="constellation-controls">
          <button
            type="button"
            disabled={matchedSlugs.length < 2}
            onClick={() => advance(-1)}
            aria-label="Previous matching resource"
          >
            ←
          </button>
          <span>
            Focus {Math.max(0, currentIndex) + 1} / {matchedSlugs.length}
            <small>
              {compact
                ? model.nodes.length > 1
                  ? 'Connected neighbors shown'
                  : 'Selected resource shown'
                : `${model.nodes.length} shown · this results page`}
            </small>
          </span>
          <button
            type="button"
            disabled={matchedSlugs.length < 2}
            onClick={() => advance(1)}
            aria-label="Next matching resource"
          >
            →
          </button>
        </div>
      }
    </>
  );
}
