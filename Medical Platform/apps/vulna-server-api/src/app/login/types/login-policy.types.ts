import type { CardIdentityMode, GroupToRole, SessionPolicy } from "@ansora/core-server"

export interface LoginPolicy {
	version: number
	session: SessionPolicy
	idleLockSeconds: number
	fullLoginIntervalSeconds: number
	pinAttemptsLimit: number
	pinDelaySeconds: number
	credentialAttemptsLimit: number
	cardIdentityMode: CardIdentityMode
	cardBindingCodeLifetimeSeconds: number
	personalNumberClaim: string | undefined
	loginNameClaim: string | undefined
	emailClaim: string | undefined
	groupClaim: string | undefined
	authorizedGroup: string | undefined
	departmentClaim: string | undefined
	groupToRole: GroupToRole[]
	administration: AdministrationSessionPolicy
}

export interface AdministrationSessionPolicy {
	idleLogoutSeconds: number
	sessionMaxSeconds: number
}
