'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import {
  analyticsChoiceKey,
  analyticsPermitted,
  googleMeasurementId,
  publicPageEvent,
} from './google-policy';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  'ga-disable-G-QFECS8NSVF'?: boolean;
};
function browserPermits(choice: string | null) {
  return analyticsPermitted(
    location.origin,
    choice,
    navigator.doNotTrack,
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
  );
}
function needsPublicDocument(path: string) {
  // A Next navigation from a private page retains that document's stricter CSP.
  // Reload the public destination before loading a tag rather than expanding private CSP.
  return (
    Boolean(publicPageEvent(path)) &&
    !document
      .querySelector('meta#agentgrid-csp')
      ?.getAttribute('content')
      ?.includes('https://www.googletagmanager.com')
  );
}
function clearAnalyticsCookies() {
  for (const item of document.cookie.split(';')) {
    const name = item.trim().split('=')[0] ?? '';
    if (!/^_ga(?:_|$)/.test(name)) continue;
    for (const domain of ['', '; Domain=agentgrid.me', '; Domain=.agentgrid.me'])
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure${domain}`;
  }
}
export function GoogleAnalytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [ready, setReady] = useState(false);
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(analyticsChoiceKey);
      } catch {
        /* Default to no measurement. */
      }
      if (saved === 'granted' && browserPermits(saved) && needsPublicDocument(location.pathname)) {
        location.reload();
        return;
      }
      setChoice(saved === 'granted' || saved === 'denied' ? saved : null);
      setEligible(location.origin === 'https://agentgrid.me' && browserPermits('granted'));
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const page = publicPageEvent(pathname);
  const enabled = eligible && choice === 'granted' && Boolean(page);
  useEffect(() => {
    const target = window as AnalyticsWindow;
    target['ga-disable-G-QFECS8NSVF'] = !enabled || !browserPermits(choice);
    if (!enabled || !browserPermits(choice)) return;
    target.dataLayer ??= [];
    target.gtag ??= function (...args: unknown[]) {
      void args;
      // Google's command queue consumes Arguments objects rather than event arrays.
      // eslint-disable-next-line prefer-rest-params
      target.dataLayer!.push(arguments);
    };
    target.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    target.gtag('consent', 'update', { analytics_storage: 'granted' });
    target.gtag('js', new Date());
    target.gtag('config', googleMeasurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: 'https://agentgrid.me' + pathname,
      page_referrer: '',
      page_title: 'AgentGrid',
      cookie_expires: 60 * 60 * 24 * 90,
      cookie_update: false,
    });
  }, [enabled, choice, pathname]);
  useEffect(() => {
    if (!ready || !enabled || !browserPermits(choice)) return;
    const event = publicPageEvent(pathname);
    if (event) (window as AnalyticsWindow).gtag?.('event', 'page_view', event);
  }, [ready, enabled, choice, pathname]);
  function choose(value: 'granted' | 'denied') {
    try {
      localStorage.setItem(analyticsChoiceKey, value);
    } catch {
      setChoice('denied');
      setSettings(false);
      return;
    }
    setChoice(value);
    setSettings(false);
    if (value === 'granted' && browserPermits(value) && needsPublicDocument(location.pathname)) {
      location.reload();
      return;
    }
    if (value === 'denied') {
      (window as AnalyticsWindow)['ga-disable-G-QFECS8NSVF'] = true;
      clearAnalyticsCookies();
      if (ready) location.reload();
    }
  }
  return (
    <div className="analytics-choice" data-agentgrid-ga4={page ? googleMeasurementId : undefined}>
      {enabled && (
        <Script
          id="agentgrid-google-analytics"
          src={`https://www.googletagmanager.com/gtag/js?id=${googleMeasurementId}`}
          strategy="afterInteractive"
          onReady={() => setReady(true)}
        />
      )}
      {eligible && (settings || (choice === null && Boolean(page))) ? (
        <section className="analytics-choice-panel" aria-labelledby="analytics-choice-title">
          <h2 id="analytics-choice-title">Help improve AgentGrid?</h2>
          <p>
            Optional Google Analytics measures visits to public catalogue pages using cookies.
            Private workspace and sign-in activity are excluded. Browsing works with either choice.{' '}
            <a href="/privacy/#analytics">Privacy details</a>
          </p>
          <div className="analytics-choice-actions">
            <button type="button" onClick={() => choose('denied')}>
              Reject analytics
            </button>
            <button type="button" onClick={() => choose('granted')}>
              Allow analytics
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="analytics-choice-settings"
          onClick={() => setSettings(true)}
          disabled={!eligible}
        >
          Analytics choices{!eligible ? ' · off' : ''}
        </button>
      )}
    </div>
  );
}
