import type { LoginPolicy } from "../types/login-policy.types"

// CAP-003-R07, Q-048
export function isDepartmentFromDirectory(policy: LoginPolicy): boolean {
	return policy.departmentClaim !== undefined
}
