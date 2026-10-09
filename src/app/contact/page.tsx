import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../../components/legal/LegalPage';
import { legalOperator } from '../../domain/legal';
export const metadata: Metadata = {
  title: 'Contact the operator — AgentGrid',
  description:
    'Contact Ujjwal Paul, the individual operator of AgentGrid in India, about support, privacy, rights, package permissions or community moderation.',
  alternates: { canonical: '/contact/' },
};
export default function ContactPage() {
  return (
    <LegalPage
      title="A direct line to AgentGrid."
      summary="For support, privacy, rights and community concerns, contact the person responsible for the service."
      version="2026-10-09"
      sections={[
        {
          id: 'contact',
          title: 'Public contact',
          body: (
            <>
              <p>
                <a href={legalOperator.contactHref}>{legalOperator.email}</a>
              </p>
              <p>
                {legalOperator.name} operates AgentGrid as an individual in {legalOperator.country}.
                AgentGrid is a product and brand name, not a separately incorporated company.
              </p>
            </>
          ),
        },
        {
          id: 'include',
          title: 'Help us understand the issue',
          body: (
            <p>
              Include the relevant resource URL, what happened and the outcome you are requesting.
              For copyright or other rights concerns, identify the material, your relationship to it
              and a way to reply. For privacy requests, use the email associated with your account
              where possible. Do not send passwords, API keys, payment details or unnecessary
              sensitive information.
            </p>
          ),
        },
        {
          id: 'report',
          title: 'Community reports and permissions',
          body: (
            <>
              <p>
                The report action on a published resource or creator profile connects a concern to
                the right record. You can also use the contact address for an appeal or a concern
                about access to your account. For reuse beyond a package’s stated permissions,
                identify the package, version and proposed use.
              </p>
              <p>
                Read the{' '}
                <Link prefetch={false} href="/privacy/">
                  privacy notice
                </Link>{' '}
                and{' '}
                <Link prefetch={false} href="/terms/">
                  community terms
                </Link>{' '}
                for how AgentGrid handles information and contributions.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
