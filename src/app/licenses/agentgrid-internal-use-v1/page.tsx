import type { Metadata } from 'next';
import { LegalPage } from '../../../components/legal/LegalPage';
import { legalDocuments, legalOperator } from '../../../domain/legal';
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'AgentGrid Internal Use and Hosted Fork License 1.0',
  description:
    'Terms for designated AgentGrid first-party instruction packages: personal and commercial internal use, attributed AgentGrid forks, and reserved redistribution rights.',
  alternates: { canonical: '/licenses/agentgrid-internal-use-v1/' },
};
export default function PackageLicensePage() {
  return (
    <LegalPage
      title="Use the work. Respect its source."
      summary="AgentGrid Internal Use and Hosted Fork License 1.0. These terms apply only to packages that explicitly link to this license."
      version={legalDocuments.firstPartyLicenseVersion}
      sections={[
        {
          id: 'scope',
          title: 'What this license covers',
          body: (
            <>
              <p>
                This license is offered by Ujjwal Paul, operating AgentGrid. It covers the
                instructions, specification and examples in a first-party package bearing this
                notice, including its identified version. Application code, branding, general site
                articles, third-party material and packages with other licenses are excluded.
              </p>
              <p>
                Reading a page alone does not grant ownership or a right to reproduce the library.
                Rights available under applicable law are not limited by this license.
              </p>
            </>
          ),
        },
        {
          id: 'use',
          title: 'Personal and commercial workflows',
          body: (
            <>
              <p>
                You receive a non-exclusive, worldwide, royalty-free permission to copy the covered
                package into supported AI platforms, run it for your own personal or commercial
                work, and adapt it for your own internal use. Your employees and contractors may use
                it on your behalf for those workflows under these same restrictions.
              </p>
              <p>
                You may provide the instructions to a platform to the extent needed to run that
                workflow under its terms. This is not permission to sublicense the package as a
                product, publish it to a provider marketplace, or authorize independent reuse of the
                library. You remain responsible for the data, access and actions you authorize.
              </p>
              <p>
                You may use resulting workflow outputs, including in work delivered to customers.
                This package license does not impose a reuse restriction on those outputs. Other
                rights, laws and platform terms may still apply.
              </p>
            </>
          ),
        },
        {
          id: 'forks',
          title: 'Attributed forks within AgentGrid',
          body: (
            <>
              <p>
                You may adapt and publish a fork through AgentGrid’s fork workflow, subject to
                moderation. Keep the source name, creator attribution, source version, lineage and
                this license. Identify your changes and do not imply endorsement.
              </p>
              <p>
                Your fork must retain these conditions for the covered material and allow the same
                internal-use and AgentGrid-only fork permissions. You retain ownership of your
                original additions. This permission does not extend to public distribution of the
                covered instructions outside AgentGrid.
              </p>
            </>
          ),
        },
        {
          id: 'reserved',
          title: 'Rights that remain reserved',
          body: (
            <p>
              Except for the express permissions above, you may not republish, redistribute, resell,
              sublicense or commercially reproduce the covered package or library. You may not
              scrape or bulk copy it into competing datasets, directories or package libraries. A
              public fork within AgentGrid is a limited exception, not a general redistribution
              grant. Contact the operator for another use.
            </p>
          ),
        },
        {
          id: 'notices',
          title: 'Notices, changes and versions',
          body: (
            <>
              <p>
                Retain the license notice, source and attribution when copying instructions or
                publishing a permitted fork. Do not remove restrictions from covered material. A
                package’s stated license version governs that version; a future license does not
                silently replace permissions already granted for an earlier version.
              </p>
              <p>
                The operator may offer selected packages under different terms. Check the exact
                package and version. Community authors choose their own terms; this first-party
                license is not applied automatically to their original work.
              </p>
            </>
          ),
        },
        {
          id: 'responsibility',
          title: 'Responsibility and ending permission',
          body: (
            <>
              <p>
                Packages are provided as available, without a promise of accuracy, fitness for a
                particular purpose or uninterrupted compatibility. Review outputs and permissions
                before relying on them. Nothing excludes rights or liabilities that cannot lawfully
                be excluded.
              </p>
              <p>
                If you breach these terms, the license ends for the affected use. Stop the
                unauthorized use and contact the operator about correction or reinstatement.
                Permission may also be ended by you ceasing use and deleting your instruction
                copies, except records lawfully retained. Contact{' '}
                <a href={legalOperator.contactHref}>{legalOperator.email}</a> for permissions or
                disputes.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
