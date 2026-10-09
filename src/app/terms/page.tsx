import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../../components/legal/LegalPage';
import { legalDocuments, legalOperator } from '../../domain/legal';
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Community terms — AgentGrid',
  description:
    'AgentGrid community terms covering accounts, creator ownership, publication, package reuse, attribution, moderation and contact with the individual operator.',
  alternates: { canonical: '/terms/' },
};
export default function TermsPage() {
  return (
    <LegalPage
      title="A network built on clear terms."
      summary="The terms for joining, contributing to and using AgentGrid. Package permissions are stated separately on each resource."
      version={legalDocuments.termsVersion}
      sections={[
        {
          id: 'operator',
          title: 'The service and its operator',
          body: (
            <p>
              AgentGrid.me is a discovery and community service operated by {legalOperator.name}, an
              individual in {legalOperator.country}. References to AgentGrid, we or us mean this
              service and its operator. AgentGrid is a product name, not a separately incorporated
              company. These terms apply to the service; the{' '}
              <Link prefetch={false} href="/privacy/">
                privacy notice
              </Link>{' '}
              explains data handling.
            </p>
          ),
        },
        {
          id: 'accounts',
          title: 'Accounts and responsible use',
          body: (
            <>
              <p>
                Public resources can be read without an account. Community accounts are for people
                aged 18 or older who can enter into these terms. Keep access to your sign-in email
                secure, provide accurate information, and use only identities and content you are
                authorized to use. Do not impersonate people, fabricate reviews or activity,
                manipulate ratings, or evade moderation.
              </p>
              <p>
                Do not upload credentials, other people’s private information, unlawful material or
                content you lack permission to share. Do not use the service to facilitate harm,
                exploit vulnerabilities or interfere with other users. Ordinary search-engine
                discovery is welcome; bulk reproduction of protected packages and abusive automated
                requests are not.
              </p>
            </>
          ),
        },
        {
          id: 'ownership',
          title: 'Your work remains yours',
          body: (
            <>
              <p>
                You retain ownership of your original submissions, reviews and profile content. You
                confirm you have the rights needed to submit them. You grant the operator a
                non-exclusive permission to store, process, review, format, back up and display that
                content as needed to operate AgentGrid, honor your visibility choices and enforce
                these terms. Private drafts are not granted public display rights by being saved.
              </p>
              <p>
                Submitting a resource requests review; it does not guarantee publication or
                endorsement. For approved publication, you permit AgentGrid to display and
                distribute the package through the actions you expressly allow. Choose a license and
                permissions deliberately. AgentGrid does not automatically apply an open license to
                community work.
              </p>
            </>
          ),
        },
        {
          id: 'packages',
          title: 'Use, copies and forks',
          body: (
            <>
              <p>
                Read the exact resource version’s license before using, adapting or sharing it. An
                enabled copy or fork action is subject to those terms. Keep required attribution and
                lineage; a fork does not erase source rights. You may not substitute broader terms
                for inherited material.
              </p>
              <p>
                Designated first-party packages use the{' '}
                <Link prefetch={false} href={legalDocuments.firstPartyLicensePath}>
                  AgentGrid Internal Use and Hosted Fork License
                </Link>
                . Other packages may use different terms. The application code, brand and site
                content are not included in a package’s reuse grant. Permissions already granted for
                a released version are governed by that license; changing or hiding a page does not
                necessarily revoke them.
              </p>
            </>
          ),
        },
        {
          id: 'moderation',
          title: 'Publication, reviews and moderation',
          body: (
            <>
              <p>
                Reviews should describe your own experience, disclose relevant relationships and
                avoid private information. Staff may review submissions, reject or hide resources,
                remove abusive content or suspend accounts to enforce these terms, protect others or
                comply with law. Moderation and version records may be retained for accountability.
              </p>
              <p>
                Use the report action on a resource or profile to raise a concern. You can also{' '}
                <Link prefetch={false} href="/contact/">
                  contact the operator
                </Link>{' '}
                about a decision, rights claim or appeal. Include the relevant URL and a concise
                explanation; do not include passwords or unnecessary sensitive information.
              </p>
            </>
          ),
        },
        {
          id: 'platforms',
          title: 'Platforms, results and availability',
          body: (
            <>
              <p>
                AgentGrid distributes resources; your chosen AI platform executes them under its own
                terms. Instructions alone do not install integrations, schedule work or grant
                account access. Platform subscriptions and API usage may cost money even when an
                AgentGrid package is free.
              </p>
              <p>
                AI outputs may be inaccurate or unsafe. Review important claims and actions, use
                appropriate professional advice where needed, and keep control of credentials and
                permissions. We do not promise a specific result, uninterrupted availability or
                permanent platform compatibility. Nothing in these terms removes mandatory consumer
                rights or excludes liability that cannot lawfully be excluded.
              </p>
            </>
          ),
        },
        {
          id: 'leaving',
          title: 'Leaving and changes to these terms',
          body: (
            <>
              <p>
                You can sign out or deactivate your AgentGrid profile in account controls.
                Deactivation is not deletion of your Google account or another application’s
                identity. The{' '}
                <Link prefetch={false} href="/privacy/#retention">
                  privacy notice
                </Link>{' '}
                explains retained versions, attribution and safety records and how to request
                further deletion.
              </p>
              <p>
                Material changes will be published with a new version and brought to members’
                attention before they govern continued community participation. Existing package
                licenses are separate. Indian law applies to these service terms, subject to any
                mandatory protections that apply to you. Contact {legalOperator.name} at{' '}
                <a href={legalOperator.contactHref}>{legalOperator.email}</a> to seek resolution of
                a concern.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
