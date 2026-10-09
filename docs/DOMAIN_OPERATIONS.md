# Domain and contact-mail operations

AgentGrid's registrar remains GoDaddy. On October 9, 2026 the owner saved the
prepared custom nameservers, and the registrar confirmed:

- `deborah.ns.cloudflare.com`
- `mitchell.ns.cloudflare.com`

The destination is the personal Cloudflare Free account. Zone ID:
`885e846cc675983d21b3061071ba417b`. This is a DNS-provider change, not a domain
transfer, paid subscription or production application deployment. Domain locking,
renewal settings and all other domains remain untouched.

## Record preservation

The complete GoDaddy inventory was inspected before delegation. Its ten rows
comprised a parked apex pseudo-record, two provider NS records, a provider SOA,
four CNAMEs and two TXT records. The parked apex resolves to two A records. The
corresponding eight application records are prepared in Cloudflare, DNS-only:

| Type  | Name                     | Preserved value                                                                     |
| ----- | ------------------------ | ----------------------------------------------------------------------------------- |
| A     | `@`                      | `3.33.130.190`                                                                      |
| A     | `@`                      | `15.197.148.33`                                                                     |
| CNAME | `www`                    | `agentgrid.me`                                                                      |
| CNAME | `_domainconnect`         | `_domainconnect.gd.domaincontrol.com`                                               |
| CNAME | `rsend.mail`             | `rsend-apne1.forge.rmta.net`                                                        |
| CNAME | `send.mail`              | `send.forge.rmta.net`                                                               |
| TXT   | `resend._domainkey.mail` | Exact existing public DKIM value; retained in the local inventory                   |
| TXT   | `_dmarc`                 | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |

The DMARC record was discovered only by reading the complete registrar table and
was added before delegation. The old provider NS and SOA are not imported as
application records. Existing domain/subdomain forwarding was not configured.
DNSSEC was off, with no DS observed; no security feature was disabled for this move.

Local ignored evidence contains the complete record text, comparison and registrar
screenshots. Never confuse a public DKIM verification value with a private signing
key. Privileged provider credentials are not DNS records or documentation inputs.

## Activation and email gates

At the initial post-change check, GoDaddy showed the saved Cloudflare nameservers,
but Cloudflare remained pending and the independent public resolver still returned
the former GoDaddy nameservers. Registrar acknowledgement is not proof of propagated
DNS. Local `dig` replies were not authoritative, including a refused nonrecursive
probe; they cannot establish that the new authoritative service is serving the zone.
Cloudflare's scheduled check was requested once. Avoid repeated delegation edits
or inventing a successful activation while caches and provider checks converge.

Cloudflare confirmed `devujjwal1989@gmail.com` as a verified destination address.
This creates no routing rule by itself. The intended public address is
`contact@agentgrid.me`; routing remains unconfigured until the domain is active.
Use free Email Routing only. Do not enable the separate sending beta, paid mailbox
trial, paid Workers plan, automatic recharge or other billable service.

Once active:

1. Verify nameserver delegation and all preserved record values again. Check both
   assigned nameservers where the network permits authoritative DNS queries.
2. Prepare only `contact@agentgrid.me` forwarding to the verified personal inbox;
   keep catch-all disabled. Review exact provider-required MX/SPF/DKIM additions.
   Do not overwrite the existing DMARC or the Resend `mail` subdomain records.
3. Complete any required action-time authorization, then verify the routing rule
   and public DNS. Send an authorized delivery test and verify actual receipt.
   A verified destination or accepted API response is not proof of inbox delivery.
4. Document reply handling. Cloudflare forwarding alone does not grant permission
   or configure SMTP to send as `contact@agentgrid.me`. Replies from another address
   must not be represented as authenticated AgentGrid-domain replies.
5. Record the receiving result before opening public community registration.

Application launch is separate: do not point the apex to the staging project.
Only an accepted production build may receive the canonical domain. Validate its
TLS, fail-closed dynamic routes, crawler policy and exact callback configuration.
Enable DNSSEC deliberately after stable delegation and verify the matching DS;
never copy an old provider's DS to new signing keys.

If activation remains pending beyond the provider's stated propagation window,
compare the registry delegation, assigned nameservers and DNSSEC state. Retain the
old inventory and avoid deleting zones or repeatedly changing nameservers as a
diagnostic step. Consult the [official zone-status reference](https://developers.cloudflare.com/dns/zone-setups/reference/domain-status/).
