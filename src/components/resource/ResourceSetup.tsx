'use client';

import { measure } from '../../analytics/client';
import { useEffect, useState } from 'react';
import type { PublicResource } from '../../domain/public-resource';
import type { AgentSpecification } from '../../domain/agent-specification';
import { platformLabel } from '../../domain/platforms';
import { compatibilityNote } from '../../domain/compatibility-note';
import {
  distributionPolicy,
  attributedInstructionText,
  resourcePackage,
} from '../../domain/distribution';

export function ResourceSetup({
  specification: spec,
  publication,
}: {
  specification: AgentSpecification;
  publication: PublicResource | null;
}) {
  const published = Boolean(publication);
  const [platform, setPlatform] = useState(spec.platforms[0]?.slug ?? '');
  const [downloadReady, setDownloadReady] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const policy = distributionPolicy(spec, published, platform);
  const selected = spec.platforms.find((item) => item.slug === platform);
  const compatibility = selected
    ? compatibilityNote(selected.compatibility_notes, published)
    : null;
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_AGENTGRID_ANALYTICS !== '1') return;
    if (!publication) return;
    const timer = setTimeout(
      () =>
        measure({
          event: 'agent_view',
          resourceId: publication.resource_id,
          versionId: publication.version_id,
        }),
      500,
    );
    return () => clearTimeout(timer);
  }, [publication]);
  async function copy() {
    if (!policy.canCopy || !publication) return;
    try {
      await navigator.clipboard.writeText(attributedInstructionText(publication, platform));
      setCopyState('copied');
      measure({
        event: 'copy_instructions',
        resourceId: publication.resource_id,
        versionId: publication.version_id,
        platform,
      });
    } catch {
      setCopyState('manual');
    }
  }
  function download() {
    if (!publication || !policy.canExport) return;
    const bytes = JSON.stringify(resourcePackage(publication), null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${spec.identity.slug}.${spec.version}.agentgrid.json`;
    link.click();
    setDownloadReady(true);
    measure({
      event: 'definition_download',
      resourceId: publication.resource_id,
      versionId: publication.version_id,
    });
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="resource-section setup-section"
      id="use-agent"
      aria-labelledby="setup-heading"
    >
      <p className="eyebrow">Bring the instructions to your workspace</p>
      <h2 id="setup-heading">Set up your agent.</h2>
      <p>
        AgentGrid provides the resource. Your chosen platform runs it under its own terms and
        privacy settings.
      </p>
      <label htmlFor="setup-platform">Choose your platform</label>
      <select
        id="setup-platform"
        value={platform}
        onChange={(event) => {
          setPlatform(event.target.value);
          if (publication)
            measure({
              event: 'platform_select',
              resourceId: publication.resource_id,
              versionId: publication.version_id,
              platform: event.target.value,
            });
          setCopyState('idle');
        }}
      >
        {spec.platforms.map((item) => (
          <option key={item.slug} value={item.slug}>
            {platformLabel(item.slug)}
          </option>
        ))}
      </select>
      {selected && (
        <>
          <p className="setup-compatibility">{compatibility?.current}</p>
          {compatibility?.original && (
            <details className="instruction-disclosure">
              <summary>Original pre-release authoring note</summary>
              <p>
                This note was written before publication. The version is now released; check the
                examples in your own host before use.
              </p>
              <p>{compatibility.original}</p>
            </details>
          )}
          <ol className="setup-steps">
            {selected.setup_steps.map((step, index) => (
              <li key={`${selected.slug}-${index}`}>
                <h3>{step.title}</h3>
                <p>{step.instructions}</p>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className="resource-action-row">
        <button type="button" disabled={!policy.canCopy} onClick={() => void copy()}>
          Copy instructions <span aria-hidden="true">↗</span>
        </button>
        {policy.canExport && (
          <button type="button" onClick={download}>
            Download definition <span aria-hidden="true">↓</span>
          </button>
        )}
        <span role="status">
          {copyState === 'copied'
            ? 'Instructions copied.'
            : copyState === 'manual'
              ? 'Clipboard unavailable. Select the instructions below to copy them manually.'
              : (policy.reason ?? '')}
        </span>
      </div>
      {downloadReady && (
        <p role="status">
          Definition prepared with the package’s license and source attribution. Check your browser
          downloads.
        </p>
      )}
      <details className="instruction-disclosure" open={copyState === 'manual'}>
        <summary>Read the full system instructions</summary>
        <textarea
          aria-label="Complete agent instructions"
          readOnly
          value={
            publication && policy.canCopy
              ? attributedInstructionText(publication, platform)
              : spec.execution.instructions
          }
          rows={12}
        />
      </details>
      <p className="resource-cost">
        <strong>AgentGrid access: free.</strong> {spec.pricing.platform_costs}
      </p>
    </section>
  );
}
