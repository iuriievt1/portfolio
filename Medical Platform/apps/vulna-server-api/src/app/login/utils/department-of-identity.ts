import { type AuthenticatedIdentity, departmentOf } from "@ansora/core-server"
import type { LoginPolicy } from "../types/login-policy.types"

export function departmentOfIdentity(identity: AuthenticatedIdentity, policy: LoginPolicy): string | undefined {
	return policy.departmentClaim === undefined ? undefined : departmentOf(identity.claims, policy.departmentClaim)
}
