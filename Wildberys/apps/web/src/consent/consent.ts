import { useSyncExternalStore } from 'react';

/** What a visitor decided about the measuring of visits, and when. */
export interface Consent {
  readonly analytics: boolean;
  /** When the visitor decided, in milliseconds. */
  readonly decidedAt: number;
}

/** The choice is kept in a cookie of our own. It is needed for the site to work as asked, so it needs no consent. */
const cookieName = 'bluberi_consent';

/** A new number asks everybody again: for a change of what we ask consent for. */
const version = 1;

const day = 24 * 60 * 60 * 1000;

/**
 * How long a choice holds, as the Czech data protection authority recommends: a consent
 * for 12 months, and after a refusal we do not ask again for 6 months.
 */
const validFor = { accepted: 365 * day, refused: 183 * day } as const;

function lifetime(analytics: boolean): number {
  return analytics ? validFor.accepted : validFor.refused;
}

/** The cookie holds the version, the choice and its time: "1.1.1794920000". */
function parse(text: string | undefined, now: number): Consent | null {
  const [storedVersion, choice, seconds, ...rest] = (text ?? '').split('.');
  const decidedAt = Number(seconds) * 1000;

  if (
    rest.length > 0 ||
    storedVersion !== String(version) ||
    (choice !== '1' && choice !== '0') ||
    !Number.isInteger(decidedAt) ||
    decidedAt <= 0
  ) {
    return null;
  }

  const analytics = choice === '1';

  return now - decidedAt < lifetime(analytics) ? { analytics, decidedAt } : null;
}

function storedText(): string | undefined {
  return document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

const listeners = new Set<() => void>();
let cachedText: string | undefined;
let cachedConsent: Consent | null = null;
let settingsOpen = false;

function tellEveryone(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function read(): Consent | null {
  const text = storedText();

  // React needs the same object while nothing changed, so the last answer is kept.
  if (text !== cachedText) {
    cachedText = text;
    cachedConsent = parse(text, Date.now());
  }

  return cachedConsent;
}

/** Keeps the choice of the visitor and closes the question. */
export function decide(analytics: boolean): void {
  const seconds = Math.floor(Date.now() / 1000);
  const secure = location.protocol === 'https:' ? '; Secure' : '';

  document.cookie = `${cookieName}=${String(version)}.${analytics ? '1' : '0'}.${String(seconds)}; Max-Age=${String(lifetime(analytics) / 1000)}; Path=/; SameSite=Lax${secure}`;
  settingsOpen = false;
  tellEveryone();
}

/** Shows the question again, for a visitor who wants to change the choice. */
export function openCookieSettings(): void {
  settingsOpen = true;
  tellEveryone();
}

/**
 * The choice of the visitor: nothing while the page does not know it yet (on the server and
 * until the browser has read the cookie), null when the visitor has not decided, or the choice.
 */
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

/** Whether the visitor asked to see the question again. */
export function useCookieSettingsOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => settingsOpen,
    () => false,
  );
}
