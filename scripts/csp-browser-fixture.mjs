/** Deliberately hostile, disposable localhost-only document. Never exported. */
import { hardenDocument } from './static-csp.mjs';
export function cspBrowserFixture() {
  const approved = `document.querySelector('#approved').textContent='Approved bootstrap ran';
try { (0,eval)('1 + 1'); document.querySelector('#evaluation').textContent='UNSAFE: eval ran'; }
catch { document.querySelector('#evaluation').textContent='Dynamic evaluation blocked'; }
document.addEventListener('securitypolicyviolation',event=>{
const item=document.createElement('li');item.textContent=event.violatedDirective;
document.querySelector('#violations').append(item);});`;
  const html =
    hardenDocument(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AgentGrid local CSP acceptance</title></head><body>
<h1>Disposable CSP acceptance</h1><p>This fixture deliberately attempts three disallowed script operations. No account or provider is involved.</p>
<p id="approved">Bootstrap pending</p><p id="evaluation">Evaluation pending</p>
<p id="injected">Unapproved inline script did not run</p><p id="handler">Inline event handler did not run</p>
<ul id="violations" aria-label="Blocked operations"></ul><script>${approved}</script></body></html>`);
  return html.replace(
    '</body>',
    `<script>document.querySelector('#injected').textContent='UNSAFE: injected script ran';</script>
<button onclick="document.querySelector('#handler').textContent='UNSAFE: handler ran'">Attempt inline event handler</button></body>`,
  );
}
