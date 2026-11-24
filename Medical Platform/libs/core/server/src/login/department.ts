import { DEPARTMENT_CODE_MAX_LENGTH } from "@ansora/contracts"
import { claimTextOf } from "./claims"

export const DEPARTMENT_ORIGIN = {
	MANUAL: "manual",
	DIRECTORY: "directory",
} as const

export type DepartmentOrigin = (typeof DEPARTMENT_ORIGIN)[keyof typeof DEPARTMENT_ORIGIN]

// CAP-003-R07, Q-048
export function departmentOf(claims: Readonly<Record<string, unknown>>, claimName: string): string | undefined {
	return claimTextOf(claims, claimName, DEPARTMENT_CODE_MAX_LENGTH)
}
