const labels: Record<string, string> = {
  identity: 'Agent identity',
  name: 'Name',
  slug: 'Resource path',
  summary: 'Summary',
  version: 'Package version',
  category: 'Category',
  purpose: 'Purpose and audience',
  capabilities: 'Capabilities',
  id: 'Identifier',
  description: 'Description',
  execution: 'Behavior',
  instructions: 'System instructions',
  mode: 'Execution mode',
  autonomy: 'Action boundary',
  artifact_path: 'Artifact path',
  artifact_sha256: 'Artifact checksum',
  inputs: 'Inputs',
  outputs: 'Outputs',
  label: 'Label',
  format: 'Format',
  required: 'Required input',
  contains_sensitive_data: 'Sensitive data',
  requirements: 'Requirements',
  platforms: 'Platforms',
  distribution: 'Distribution format',
  setup_steps: 'Setup steps',
  title: 'Title',
  compatibility_notes: 'Compatibility notes',
  tools: 'Tools',
  kind: 'Connection kind',
  requirement_id: 'Linked requirement',
  permissions: 'Permissions',
  resource: 'Resource accessed',
  operation: 'Operation',
  justification: 'Access justification',
  confirmation_required: 'Approval requirement',
  safety: 'Safety',
  limitations: 'Limitations',
  privacy: 'Privacy and data handling',
  approval_policy: 'Approval policy',
  untrusted_input_policy: 'Untrusted input policy',
  prohibited_actions: 'Prohibited actions',
  examples: 'Examples',
  input: 'Example input',
  expected_output: 'Expected output',
  assertions: 'Checks',
  pricing: 'Costs',
  platform_costs: 'Platform costs',
  license: 'Reuse terms',
  identifier: 'License',
  statement: 'License statement',
  url: 'Terms URL',
  use: 'Use permission',
  modify: 'Modification permission',
  redistribute: 'Redistribution permission',
  public_fork: 'Public fork permission',
  extensions: 'Portable extensions',
};
export function formatAuthoringIssue(issue: {
  path: readonly PropertyKey[];
  code: string;
  message: string;
  minimum?: number | bigint;
  origin?: string;
}): string {
  const location =
    issue.path
      .map((part) =>
        typeof part === 'number' ? String(part + 1) : (labels[String(part)] ?? 'Definition'),
      )
      .join(' · ') || 'Definition';
  const message =
    issue.code === 'too_small' && issue.origin === 'array'
      ? `Include at least ${String(issue.minimum)} item${issue.minimum === 1 ? '' : 's'}.`
      : issue.code === 'too_small' && issue.origin === 'string'
        ? 'Add more detail here.'
        : issue.code === 'invalid_format'
          ? 'Use the format described in this field’s guidance.'
          : issue.code === 'invalid_type'
            ? 'Complete this section using the expected field format.'
            : issue.message;
  return location + ': ' + message;
}
