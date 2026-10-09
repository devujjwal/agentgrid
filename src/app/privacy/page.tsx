import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../../components/legal/LegalPage';
import { legalDocuments, legalOperator } from '../../domain/legal';
export const metadata: Metadata = {
  title: 'Privacy notice — AgentGrid',
  description:
    'How AgentGrid handles sign-in, profiles, saved resources, submissions, security records and deletion requests, with contact details for the individual operator.',
  alternates: { canonical: '/privacy/' },
};
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Know what you share."
      summary="Browsing, signing in and publishing are different choices. This notice explains the information each one involves."
      version={legalDocuments.privacyVersion}
      sections={[
        {
          id: 'operator',
          title: 'Who handles your information',
          body: (
            <p>
              {legalOperator.name}, an individual in {legalOperator.country}, operates AgentGrid.me
              and is responsible for its use of personal information. Contact{' '}
              <a href={legalOperator.contactHref}>{legalOperator.email}</a> for privacy questions,
              requests or complaints. AgentGrid is the product name.
            </p>
          ),
        },
        {
          id: 'browsing',
          title: 'Browsing and search',
          body: (
            <>
              <p>
                You can browse without signing in. Hosting providers process connection information
                such as IP address, request URL and browser information to deliver and protect the
                site. Task search runs against the discovery catalogue in your browser; AgentGrid
                does not send your raw search wording to an AI provider.
              </p>
              <p>
                Optional product analytics and advertising are currently disabled. AgentGrid does
                not currently use advertising cookies or sell personal information. Any future
                measurement or advertising change will be described before activation, with choices
                where required.
              </p>
            </>
          ),
        },
        {
          id: 'identity',
          title: 'Sign-in and essential storage',
          body: (
            <>
              <p>
                Email sign-in uses the address you provide to deliver a one-time code. Google
                sign-in uses the identity information returned for authentication, including your
                verified email and provider identifier. It does not request access to your Gmail
                inbox, Drive files or contacts. Signing in alone does not publish a creator profile.
              </p>
              <p>
                We use essential cookies for secure sessions, sign-in continuity and request-forgery
                protection. Provider tokens are encrypted on the server; the browser receives an
                opaque session identifier. Application sessions expire after at most 30 days.
                Signing out ends the current AgentGrid session; it does not sign you out of other
                products.
              </p>
              <p>
                Security checks use short-lived sign-in state, attempt counts and keyed pseudonyms
                derived from addresses or connection information to limit abuse. These records
                support authentication and protection, not advertising profiles.
              </p>
            </>
          ),
        },
        {
          id: 'community',
          title: 'Your community information',
          body: (
            <>
              <p>
                Creating a member profile records your chosen username and display name, account
                link and accepted document versions. Optional biography, website and public
                visibility settings control your creator presentation. Saves and unfinished drafts
                are private to your account and authorized service operations.
              </p>
              <p>
                Submissions, versions, instructions and examples are processed for review and
                publication. Approved content, public creator details, permitted fork attribution
                and visible reviews may be available to other people and search engines. Reports,
                moderation notes, account roles and private review evidence are restricted to
                authorized workflows. Do not place confidential data or credentials in content you
                submit.
              </p>
            </>
          ),
        },
        {
          id: 'providers',
          title: 'Service providers and AI platforms',
          body: (
            <>
              <p>
                Cloudflare delivers the site and server endpoints; Supabase provides identity and
                database infrastructure; Resend sends requested sign-in messages. They process
                information needed to provide those services. The current database is hosted in
                Mumbai, India; provider delivery and support systems may process data in other
                countries under their own safeguards and terms.
              </p>
              <p>
                Identity infrastructure is currently shared with another independently operated
                application, PicMagic. AgentGrid profile, authorization and application records are
                separate. Using AgentGrid does not grant access to PicMagic data, and AgentGrid
                deactivation does not delete a shared identity used there.
              </p>
              <p>
                When you copy a package into an AI platform, the information you supply there is
                handled by that platform. AgentGrid does not execute your prompt or collect the
                resulting conversation through the copy action. External links take you to services
                with their own privacy practices.
              </p>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'Retention and account deactivation',
          body: (
            <>
              <p>
                Active account information is kept to provide your account and community features.
                Expired sign-in state and sessions become unusable at expiry and are cleaned up in
                bounded maintenance batches. Expiry is not a promise of immediate physical erasure
                from every provider backup.
              </p>
              <p>
                Deactivating your AgentGrid profile removes private drafts and saves, withdraws
                pending submissions, hides owned resources and authored reviews, and deidentifies
                the public profile. Submitted immutable versions, fork lineage, reports, moderation
                and security records may remain where needed for attribution, rights, abuse
                prevention or legal obligations. Deactivation does not erase all historical content
                or third-party copies.
              </p>
              <p>
                You may request further access, correction or deletion at{' '}
                <a href={legalOperator.contactHref}>{legalOperator.email}</a>. We will verify the
                request proportionately and explain records that must be retained and why. We do not
                delete shared authentication identities without considering other applications that
                depend on them.
              </p>
            </>
          ),
        },
        {
          id: 'choices',
          title: 'Your choices and requests',
          body: (
            <>
              <p>
                You can edit your profile and visibility, remove saves, manage review visibility,
                sign out and use account-deactivation controls. Contact the operator to request a
                copy of your information, correct records you cannot edit, withdraw a permission,
                ask about retention or raise a privacy concern. Withdrawing information needed for
                an account may mean the associated feature can no longer be provided.
              </p>
              <p>
                Community accounts are intended for adults aged 18 or older. If you believe a
                child’s information has been submitted, contact us so it can be reviewed. Do not
                submit another person’s private information without appropriate authority.
              </p>
              <p>
                We will update this notice when material practices change and show the new version.
                Read the{' '}
                <Link prefetch={false} href="/terms/">
                  community terms
                </Link>{' '}
                for publication and reuse rules.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
