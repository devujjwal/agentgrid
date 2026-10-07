'use client';
import { useSyncExternalStore } from 'react';

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}
function callbackFailed() {
  return new URLSearchParams(window.location.search).get('notice') === 'verification-unavailable';
}
export function CallbackNotice() {
  const failed = useSyncExternalStore(subscribe, callbackFailed, () => false);
  return failed ? (
    <p className="identity-error" role="alert">
      Google sign-in could not be verified. Start a fresh attempt here; expired or reused links
      cannot connect your account.
    </p>
  ) : null;
}
