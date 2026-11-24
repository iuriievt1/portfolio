import { CLOCK_SKEW_TOLERANCE_SECONDS, MILLISECONDS_PER_SECOND } from "@ansora/core-server"

function whoseLogin(userId: string | undefined): string {
	return userId === undefined ? "a user Vulna does not know yet" : `user ${userId}`
}

// CAP-001-R26, Q-007
export function staleAuthenticationWarning(
	authTime: number | undefined,
	flowStartedAt: Date,
	userId: string | undefined,
): string {
	const refused = `Refused the administration login of ${whoseLogin(userId)}`
	if (authTime === undefined) {
		return `${refused}: the identity provider returned an ID token without auth_time although the login asked for max_age=0`
	}
	const authenticatedAt = new Date(authTime * MILLISECONDS_PER_SECOND)
	const secondsBefore = Math.round((flowStartedAt.getTime() - authenticatedAt.getTime()) / MILLISECONDS_PER_SECOND)
	return (
		`${refused}: the identity provider last asked for the credentials at ${authenticatedAt.toISOString()}, ` +
		`${secondsBefore} s before the login started at ${flowStartedAt.toISOString()} (tolerance ${CLOCK_SKEW_TOLERANCE_SECONDS} s), ` +
		"so it reused an earlier sign-in despite prompt=login and max_age=0"
	)
}
