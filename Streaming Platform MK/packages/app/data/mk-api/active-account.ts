/**
 * Holds the user access token of the account currently selected in the account
 * switcher. `boot()` reads it instead of the env token, so switching an account
 * plus `resetCaches()` is enough to re-bootstrap the whole MK session.
 */

let _activeUserAccessToken: string | null = null

/** Overrides the env user token. Pass `null` to fall back to `NEXT_PUBLIC_MK_USER_ACCESS_TOKEN`. */
export function setActiveUserAccessToken(token: string | null): void {
	_activeUserAccessToken = token?.trim() || null
}

export function getActiveUserAccessToken(): string | null {
	return _activeUserAccessToken
}
