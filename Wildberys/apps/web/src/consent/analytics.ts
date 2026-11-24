declare global {
  interface Window {
    /** Google Analytics, once a visitor allowed the measuring and the script has loaded. */
    gtag?: (...values: unknown[]) => void;
  }
}

/** How long the cookies of Google Analytics stay in the browser: 12 months, the same as the consent. */
const cookieLifetimeSeconds = 365 * 24 * 60 * 60;

/**
 * The script that starts Google Analytics. It runs only after a visitor allowed the measuring.
 * Advertising stays off: nobody is asked about it. It is the snippet Google gives, as text,
 * because Google Analytics needs the "arguments" of the function as they are.
 */
export function setupScript(id: string): string {
  return `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
gtag('js', new Date());
gtag('config', '${id}', { cookie_expires: ${String(cookieLifetimeSeconds)}, allow_google_signals: false, allow_ad_personalization_signals: false });`;
}

/** The address Google Analytics is loaded from. */
export function scriptUrl(id: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${id}`;
}

/** The names of the cookies Google Analytics keeps for a property. */
function cookieNames(id: string): string[] {
  return ['_ga', `_ga_${id.replace(/^G-/, '')}`];
}

/** Google Analytics sets its cookies on the widest domain it can: "shop.example.cz" gives ".example.cz" too. */
function cookieDomains(): string[] {
  const parts = location.hostname.split('.');

  return parts.map((_part, index) => parts.slice(index).join('.'));
}

/**
 * Turns the measuring on or off for a visitor who changed the choice after Google Analytics
 * was loaded. Turning it off also removes its cookies from the browser.
 */
export function setMeasuring(id: string, allowed: boolean): void {
  // The switch Google Analytics reads before it sends anything.
  Reflect.set(window, `ga-disable-${id}`, !allowed);
  window.gtag?.('consent', 'update', { analytics_storage: allowed ? 'granted' : 'denied' });

  if (!allowed) {
    for (const name of cookieNames(id)) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;

      for (const domain of cookieDomains()) {
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`;
      }
    }
  }
}

/**
 * Tells Google Analytics that something happened on the page, for example a form was sent.
 * It does nothing for a visitor who did not allow the measuring. Only the name of the event
 * is sent, never what a person typed.
 */
export function trackEvent(name: string): void {
  window.gtag?.('event', name);
}
