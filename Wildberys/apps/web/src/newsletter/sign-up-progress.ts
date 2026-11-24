import { createTabStore } from '@bluberi/ui/tab-store';

/**
 * What a person has done with the sign-up for news in this tab: what they have typed, or that
 * they are signed up. The email is not kept once it is on the list.
 */
export type SignUpProgress =
  | { readonly joined: false; readonly email: string; readonly consent: boolean }
  | { readonly joined: true };

function toProgress(stored: unknown): SignUpProgress | undefined {
  if (typeof stored !== 'object' || stored === null || !('joined' in stored)) {
    return undefined;
  }

  if (stored.joined === true) {
    return { joined: true };
  }

  return 'email' in stored &&
    typeof stored.email === 'string' &&
    'consent' in stored &&
    typeof stored.consent === 'boolean'
    ? { joined: false, email: stored.email, consent: stored.consent }
    : undefined;
}

/** Kept in the tab, so the form stays as it is over a reload of the page and a change of language. */
export const signUpProgress = createTabStore({
  storageKey: 'bluberi.newsletter',
  toValue: toProgress,
});
