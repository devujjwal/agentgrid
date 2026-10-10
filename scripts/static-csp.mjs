/** Build-time HTML policy. Never runs in the browser or Cloudflare Worker. */
import { createHash } from 'node:crypto';
import { parse } from 'parse5';
export { documentHeaderPolicy } from '../src/domain/document-security.ts';
const marker = 'agentgrid-csp';
const hash = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

function inspect(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html) > 2_000_000)
    throw new Error('Document exceeds the static policy bound.');
  const errors = [];
  const document = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError: (error) => errors.push(error.code),
  });
  if (errors.length) throw new Error('Malformed generated HTML cannot receive a policy.');
  let head, charset;
  let googleAnalytics = false;
  let localReels = false;
  const policies = [],
    scripts = new Set(),
    styles = new Set();
  function visit(node) {
    const attributes = new Map((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (attributes.get('data-agentgrid-ga4') === 'G-QFECS8NSVF') googleAnalytics = true;
    if (attributes.get('data-agentgrid-local-reels') === '1') localReels = true;
    if (node.tagName === 'head') head = node;
    if (node.tagName === 'base' || [...attributes.keys()].some((name) => /^on/i.test(name)))
      throw new Error('Generated HTML contains an unsupported executable attribute or base.');
    if (node.tagName === 'meta') {
      if ((attributes.get('http-equiv') ?? '').toLowerCase().startsWith('content-security-policy'))
        policies.push(node);
      if (attributes.has('charset')) {
        if (
          charset ||
          attributes.get('charset').toLowerCase() !== 'utf-8' ||
          node.parentNode?.tagName !== 'head'
        )
          throw new Error('Document encoding must be a single UTF-8 head declaration.');
        charset = node;
      }
    }
    if (node.tagName === 'script' || node.tagName === 'style') {
      if (!node.sourceCodeLocation?.endTag) throw new Error('Unclosed script or style.');
      const text = (node.childNodes ?? []).map((child) => child.value ?? '').join('');
      if (node.tagName === 'script' && attributes.has('src')) {
        if (!/^\/_next\/static\/[a-zA-Z0-9_./-]+\.js$/.test(attributes.get('src')) || text.trim())
          throw new Error('Only generated same-origin script assets are supported.');
      } else (node.tagName === 'script' ? scripts : styles).add(hash(text));
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  }
  visit(document);
  if (!head?.sourceCodeLocation?.startTag || !charset?.sourceCodeLocation)
    throw new Error('Explicit document head and UTF-8 declaration required.');
  const beforeCharset = html.slice(
    head.sourceCodeLocation.startTag.endOffset,
    charset.sourceCodeLocation.startOffset,
  );
  if (beforeCharset.trim() || charset.sourceCodeLocation.endOffset > 1024)
    throw new Error('Encoding must be the first head element.');
  if (scripts.size > 128 || styles.size > 128) throw new Error('Unexpected inline block count.');
  const policy = [
    "default-src 'none'",
    `script-src 'self' ${googleAnalytics ? 'https://www.googletagmanager.com ' : ''}${[...scripts].sort().join(' ')}`.trim(),
    "script-src-attr 'none'",
    `style-src 'self' ${[...styles].sort().join(' ')}`.trim(),
    // React's declarative styles and bounded network coordinates may set style attributes.
    // This grants no inline script/event-handler authority.
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data:${localReels ? ' blob:' : ''}${googleAnalytics ? ' https://www.google-analytics.com https://region1.google-analytics.com' : ''}`,
    ...(localReels ? ["media-src 'self' blob:"] : []),
    "font-src 'self'",
    `connect-src 'self'${googleAnalytics ? ' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com' : ''}`,
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; ');
  return { policy, policies, insertAt: charset.sourceCodeLocation.endOffset };
}

export function hardenDocument(html) {
  const { policy, policies, insertAt } = inspect(html);
  if (policies.length)
    throw new Error('Document already contains a CSP; rebuild rather than stacking policies.');
  const meta = `<meta id="${marker}" http-equiv="Content-Security-Policy" content="${policy}"/>`;
  return html.slice(0, insertAt) + meta + html.slice(insertAt);
}

export function verifyDocumentPolicy(html) {
  const { policy, policies, insertAt } = inspect(html);
  if (policies.length !== 1) throw new Error('Exactly one generated document CSP required.');
  const node = policies[0],
    attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
  if (
    node.parentNode?.tagName !== 'head' ||
    node.sourceCodeLocation?.startOffset !== insertAt ||
    attributes.get('id') !== marker ||
    attributes.get('content') !== policy
  )
    throw new Error('Document CSP is missing, misplaced or does not match its inline blocks.');
  return policy;
}
