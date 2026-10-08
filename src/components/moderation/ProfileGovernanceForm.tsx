'use client';
import { useState } from 'react';
import {
  availableProfileDecisions,
  profileDecisionLabels,
  ProfileDecisionSchema,
  type AdminProfile,
  type ProfileDecision,
} from '../../domain/profile-governance';
import type { ProfileGovernanceBuffer } from '../authoring/CreatorMemory';
import { ConfirmAction } from '../feedback/ConfirmAction';
export function ProfileGovernanceForm({
  profile,
  email,
  notes,
  change,
  busy,
  canAdopt,
  submit,
}: {
  profile: AdminProfile;
  email: string;
  notes: ProfileGovernanceBuffer | null;
  change: (value: ProfileGovernanceBuffer) => void;
  busy: boolean;
  canAdopt: boolean;
  submit: (value: ProfileDecision) => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const value: ProfileGovernanceBuffer = notes ?? {
    email,
    username: profile.username,
    profileId: profile.id,
    revision: profile.revision,
    decision: '',
    explanation: '',
    uncertain: false,
  };
  const decisions = availableProfileDecisions(profile),
    stale = value.revision !== profile.revision || value.uncertain;
  const parsed = ProfileDecisionSchema.safeParse({
    profileId: profile.id,
    expectedRevision: value.revision,
    decision: value.decision,
    explanation: value.explanation,
  });
  const valid =
    parsed.success && decisions.includes(parsed.data.decision) && confirmation === profile.username;
  if (!decisions.length)
    return (
      <p className="moderation-notice">
        This detached or deactivated profile cannot be restored or assigned staff authority here.
      </p>
    );
  return (
    <section className="moderation-decision" aria-labelledby="profile-decision-title">
      <h2 id="profile-decision-title">One decision. A clear reason.</h2>
      <p>
        Suspension blocks AgentGrid membership and live resource access. Restoration restores
        membership; individual blocked or archived agents keep their own status. Shared
        authentication and other applications remain unchanged.
      </p>
      <p>
        Moderators can review community content. Administrators can also manage profiles and staff
        roles. The final active administrator cannot be removed or suspended.
      </p>
      {stale && (
        <aside className="moderation-notice">
          <p>
            Your held decision needs a fresh review. Compare the current profile and roles above;
            the previous action is not automatically retried.
          </p>
          <button
            className="action-secondary"
            disabled={busy || !canAdopt}
            onClick={() => {
              setConfirmation('');
              change({ ...value, revision: profile.revision, decision: '', uncertain: false });
            }}
          >
            Review against this profile revision
          </button>
        </aside>
      )}
      <fieldset className="moderation-fields" disabled={busy || stale}>
        <legend>Administrator decision</legend>
        <label htmlFor="profile-governance-action">Action</label>
        <select
          id="profile-governance-action"
          value={value.decision}
          onChange={(event) => {
            const action = event.target.value;
            if (action === '' || decisions.includes(action as ProfileDecision['decision']))
              change({ ...value, decision: action as ProfileGovernanceBuffer['decision'] });
          }}
        >
          <option value="">Choose an action</option>
          {decisions.map((action) => (
            <option key={action} value={action}>
              {profileDecisionLabels[action]}
            </option>
          ))}
        </select>
        <label htmlFor="profile-governance-reason">Reason and supporting evidence</label>
        <textarea
          id="profile-governance-reason"
          rows={5}
          minLength={20}
          maxLength={2360}
          value={value.explanation}
          aria-describedby="profile-governance-help"
          onChange={(event) => change({ ...value, explanation: event.target.value })}
        />
        <p id="profile-governance-help">
          20–2,360 characters. Record the reason without passwords, tokens or unnecessary personal
          information. This becomes a retained staff audit entry.
        </p>
        <label htmlFor="profile-governance-confirm">
          Type {profile.username} to confirm the person
        </label>
        <input
          id="profile-governance-confirm"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          maxLength={30}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
      </fieldset>
      <ConfirmAction
        label={busy ? 'Recording decision…' : 'Review profile decision'}
        title={
          value.decision ? profileDecisionLabels[value.decision] + '?' : 'Review profile decision'
        }
        description={`This affects @${profile.username} on AgentGrid and records your reason. ${value.decision === 'grant-administrator' ? 'Administrator authority includes granting staff roles and suspending accounts.' : 'Previously downloaded resources and search-engine copies cannot be recalled.'}`}
        confirmation={value.decision ? profileDecisionLabels[value.decision] : 'Confirm decision'}
        disabled={busy || stale || !valid}
        confirm={() => {
          if (parsed.success && valid) submit(parsed.data);
        }}
      />
    </section>
  );
}
