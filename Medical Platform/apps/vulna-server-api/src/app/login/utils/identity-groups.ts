import { type AuthenticatedIdentity, groupsOf, isAuthorizedMember } from "@ansora/core-server"
import type { LoginPolicy } from "../types/login-policy.types"

export function groupsOfIdentity(identity: AuthenticatedIdentity, policy: LoginPolicy): string[] {
	return policy.groupClaim === undefined ? [] : groupsOf(identity.claims[policy.groupClaim])
}

// CAP-001-R02, CAP-003-R04
export function isAuthorizedIdentity(identity: AuthenticatedIdentity, policy: LoginPolicy): boolean {
	return isAuthorizedMember(groupsOfIdentity(identity, policy), policy.authorizedGroup)
}
