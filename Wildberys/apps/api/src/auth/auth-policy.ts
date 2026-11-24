/** The rules of sign-in in one place. */

export const accessTokenLifetimeSeconds = 15 * 60;

/** A session ends when its refresh token has not been used for this long. */
export const sessionLifetimeDays = 30;

export const oneTimeCodeLength = 6;
export const oneTimeCodeLifetimeMinutes = 10;
/** How long to wait before asking for another code for the same address. */
export const oneTimeCodeResendSeconds = 60;
export const oneTimeCodeMaxAttempts = 5;

/** After a right password the sign-in can be finished with a code for this long. */
export const signInConfirmationMinutes = 10;

export const passwordMinLength = 10;
export const passwordMaxLength = 128;

/** A password can be set without the old one only this soon after a sign-in with a code. */
export const recentCodeSignInMinutes = 10;
