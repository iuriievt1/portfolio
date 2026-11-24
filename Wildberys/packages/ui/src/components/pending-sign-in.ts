import { createTabStore } from '../tab-store';

/** How long a code that was sent is good for. Moments in milliseconds since 1970. */
interface CodeTiming {
  /** From this moment another code can be asked for. */
  readonly resendAt: number;
  /** After this moment the code no longer works. */
  readonly expiresAt: number;
}

/**
 * A sign-in that is part-way through: the step it has reached.
 * - email: the person is typing the email;
 * - password: the account has a password and the person is typing it;
 * - code: a code from the email signs in;
 * - confirmation: the password was right, a code finishes the sign-in;
 * - reset: the password is forgotten, a code from the email lets the person choose a new one.
 */
export type PendingSignIn =
  | { readonly step: 'email'; readonly email: string }
  | { readonly step: 'password'; readonly email: string }
  | ({ readonly step: 'code' | 'reset'; readonly email: string } & CodeTiming)
  | ({
      readonly step: 'confirmation';
      readonly email: string;
      /** Where the code went. */
      readonly channel: 'EMAIL' | 'SMS';
      /** The last digits of the phone number when the code went by SMS. */
      readonly phoneEnding: string | null;
    } & CodeTiming);

function hasCodeTiming(value: object): value is CodeTiming {
  return (
    'resendAt' in value &&
    typeof value.resendAt === 'number' &&
    'expiresAt' in value &&
    typeof value.expiresAt === 'number'
  );
}

function toPendingSignIn(value: unknown): PendingSignIn | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('step' in value) ||
    !('email' in value) ||
    typeof value.email !== 'string'
  ) {
    return undefined;
  }

  const { step, email } = value;

  if (step === 'email' || step === 'password') {
    return { step, email };
  }

  if (!hasCodeTiming(value)) {
    return undefined;
  }

  const timing = { resendAt: value.resendAt, expiresAt: value.expiresAt };

  if (step === 'code' || step === 'reset') {
    return { step, email, ...timing };
  }

  if (
    step === 'confirmation' &&
    'channel' in value &&
    (value.channel === 'EMAIL' || value.channel === 'SMS') &&
    'phoneEnding' in value &&
    (typeof value.phoneEnding === 'string' || value.phoneEnding === null)
  ) {
    return { step, email, channel: value.channel, phoneEnding: value.phoneEnding, ...timing };
  }

  return undefined;
}

/**
 * Kept in the tab's own storage, so the step survives a reload of the page and a change
 * of language. It goes away when the tab is closed.
 * Only the email, the step and two moments in time are kept. Codes and passwords never are.
 */
const store = createTabStore({
  storageKey: 'bluberi.pending-sign-in',
  toValue: toPendingSignIn,
  // A step that waits for a code ends when the code does. The other steps do not end.
  isCurrent: (pending) => !('expiresAt' in pending) || pending.expiresAt > Date.now(),
});

export const savePendingSignIn = store.save;

/**
 * Forgets the step without drawing the form again. For the moment the person is signed in
 * and the page is about to change: the form should not jump back to the email first.
 */
export const forgetPendingSignIn = store.forget;

/** The sign-in that is part-way through in this tab, if there is one. */
export const usePendingSignIn = store.useValue;
