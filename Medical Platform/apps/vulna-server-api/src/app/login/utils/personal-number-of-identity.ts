import { type AuthenticatedIdentity, personalNumberOf } from "@ansora/core-server"
import type { LoginPolicy } from "../types/login-policy.types"

export function personalNumberOfIdentity(identity: AuthenticatedIdentity, policy: LoginPolicy): string | undefined {
	return policy.personalNumberClaim === undefined
		? undefined
		: personalNumberOf(identity.claims, policy.personalNumberClaim)
}
