import { sharedValue, useSharedValue } from "../../utils/shared-value"
import { currentSession } from "../session/session-store"

interface VersionAnswer {
	isRejected: boolean
	wasRejected: boolean
	hasSession: boolean
}

const rejected = sharedValue(false)

// CAP-012-R24, CAP-012-R25
export function rejectionAfter({ isRejected, wasRejected, hasSession }: VersionAnswer): boolean {
	if (isRejected) {
		return true
	}
	return hasSession && wasRejected
}

// CAP-012-R24, CAP-012-R25
export function rememberAppVersionAnswer(isRejected: boolean): void {
	rejected.set(rejectionAfter({ isRejected, wasRejected: rejected.get(), hasSession: currentSession() !== undefined }))
}

// CAP-012-S15
export function forgetAppVersionAnswer(): void {
	rejected.set(false)
}

export function useAppVersionRejected(): boolean {
	return useSharedValue(rejected)
}
