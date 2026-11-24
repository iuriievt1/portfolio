import { type AuthenticatedIdentity, emailOf, loginNameOf } from "@ansora/core-server"
import type { DirectoryAccount } from "../types/login.types"
import type { LoginPolicy } from "../types/login-policy.types"

// administration.yaml User login_name, email
export function directoryAccountOf(identity: AuthenticatedIdentity, policy: LoginPolicy): DirectoryAccount {
	const loginName =
		policy.loginNameClaim === undefined ? undefined : loginNameOf(identity.claims, policy.loginNameClaim)
	const email = policy.emailClaim === undefined ? undefined : emailOf(identity.claims, policy.emailClaim)
	return { loginName: loginName ?? null, email: email ?? null }
}
