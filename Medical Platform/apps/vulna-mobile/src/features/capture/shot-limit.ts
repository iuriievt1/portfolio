// CAP-015-R13, CAP-018-R12, E22
export function isAtLimit(count: number, limit: number | undefined): boolean {
	return limit !== undefined && count >= limit
}
