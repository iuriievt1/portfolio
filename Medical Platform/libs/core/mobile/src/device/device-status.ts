import { ERROR_CODE } from "@ansora/contracts"
import type { DeviceState } from "./registration"

export type DeviceStateValue = DeviceState["state"]

export const DEVICE_STATUS = {
	CHECKING: "checking",
	UNREGISTERED: "unregistered",
	PENDING_APPROVAL: "pending_approval",
	APPROVED: "approved",
	REVOKED: "revoked",
	BLOCKED: "blocked",
	UNREACHABLE: "unreachable",
} as const

export type DeviceStatusKind = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS]

export interface DeviceStatus {
	kind: DeviceStatusKind
	fingerprint?: string
}

export const DEVICE_ERROR_CODE = {
	UNKNOWN: ERROR_CODE.DEVICE_UNKNOWN,
	REVOKED: ERROR_CODE.DEVICE_REVOKED,
	BLOCKED: ERROR_CODE.DEVICE_BLOCKED,
	PENDING_APPROVAL: ERROR_CODE.DEVICE_PENDING_APPROVAL,
} as const

const DEVICE_ERROR_CODES: ReadonlySet<string> = new Set(Object.values(DEVICE_ERROR_CODE))

export function isDeviceErrorCode(code: string): boolean {
	return DEVICE_ERROR_CODES.has(code)
}

export interface ProblemLike {
	code?: string
}

export function deviceStatusOfState(state: DeviceStateValue): DeviceStatus {
	switch (state) {
		case "approved":
			return { kind: DEVICE_STATUS.APPROVED }
		case "pending_approval":
			return { kind: DEVICE_STATUS.PENDING_APPROVAL }
		case "revoked":
			return { kind: DEVICE_STATUS.REVOKED }
		case "blocked":
			return { kind: DEVICE_STATUS.BLOCKED }
		default: {
			const unexpected: never = state
			throw new Error(`unknown device state ${String(unexpected)}`)
		}
	}
}

export function deviceStatusOfProblem(problem: ProblemLike): DeviceStatus {
	switch (problem.code) {
		case DEVICE_ERROR_CODE.UNKNOWN:
			return { kind: DEVICE_STATUS.UNREGISTERED }
		case DEVICE_ERROR_CODE.REVOKED:
			return { kind: DEVICE_STATUS.REVOKED }
		case DEVICE_ERROR_CODE.BLOCKED:
			return { kind: DEVICE_STATUS.BLOCKED }
		case DEVICE_ERROR_CODE.PENDING_APPROVAL:
			return { kind: DEVICE_STATUS.PENDING_APPROVAL }
		default:
			return { kind: DEVICE_STATUS.UNREACHABLE }
	}
}

export function startsRegistration(status: DeviceStatus): boolean {
	return status.kind === DEVICE_STATUS.UNREGISTERED
}

export function opensWorkingScreens(status: DeviceStatus): boolean {
	return status.kind === DEVICE_STATUS.APPROVED
}
