// ADR-042 bod 7, ADR-054 bod 3, CAP-012-R30
export const PROJECT_NAME = "Ansora Vulna"
export const API_CLIENT_NAME = "Ansora Vulna API"

// CAP-021-R36, CAP-012-R30, architektura.md 3
export const WORKER_CLIENT_NAME = "Ansora Vulna worker"
export const WORKER_POLICY_NAME = "Ansora Vulna worker"

// CAP-026-R19, dorucovaci-jadro.md 6, datovy-model.md 5, ADR-050 bod 17
export const RETENTION_CLIENT_NAME = "Ansora Vulna retention"
export const RETENTION_POLICY_NAME = "Ansora Vulna retention"

// ADR-050 bod 10
export const PROJECT_FEATURES = ["transaction-bundles"] as const

// ADR-053 bod 3, ADR-053 bod 6
export const NO_ACCESS_POLICY_NAME = "Ansora Vulna no access"
export const ROLE_POLICY_NAME_PREFIX = "Ansora Vulna role "
export const DEPARTMENT_TAG_PARAMETER = "department_tag"

// ADR-050 bod 10, CAP-012-S23
export const BREAK_GLASS_POLICY_NAME = "Ansora Vulna break-glass"

export const SEARCH_LIMIT = "1000"

export function rolePolicyNameOf(role: string): string {
	return `${ROLE_POLICY_NAME_PREFIX}${role}`
}
