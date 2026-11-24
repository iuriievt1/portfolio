const SHORT_UID_LENGTH = 6

export function shortCardUid(identifier: string): string {
	return identifier.slice(-SHORT_UID_LENGTH).toUpperCase()
}
