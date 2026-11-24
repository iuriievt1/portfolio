import { createTabStore } from '@bluberi/ui/tab-store';

/**
 * What a person has done with the form that stops the news, in this tab:
 * the email they are typing, or the moment they were told it is done.
 */
export type UnsubscribeProgress =
  { readonly done: false; readonly email: string } | { readonly done: true; readonly at: number };

/** How long the page says "done" before it offers the form again, for another email. */
const doneForMs = 10 * 60 * 1000;

function toProgress(stored: unknown): UnsubscribeProgress | undefined {
  if (typeof stored !== 'object' || stored === null || !('done' in stored)) {
    return undefined;
  }

  if (stored.done === true) {
    return 'at' in stored && typeof stored.at === 'number'
      ? { done: true, at: stored.at }
      : undefined;
  }

  return 'email' in stored && typeof stored.email === 'string'
    ? { done: false, email: stored.email }
    : undefined;
}

/** Kept in the tab, so the page stays as it is over a reload and a change of language. */
export const unsubscribeProgress = createTabStore({
  storageKey: 'bluberi.unsubscribe',
  toValue: toProgress,
  isCurrent: (progress) => !progress.done || progress.at + doneForMs > Date.now(),
});
