import { DEVICE_STATUS, type DeviceStatus } from "@ansora/core-mobile"
import * as SecureStore from "expo-secure-store"

const DEVICE_REGISTERED_KEY = "ansora.vulna.device-registered"
const REGISTERED = "true"
const UNREGISTERED = "false"

const KNOWN_TO_SERVER: ReadonlySet<DeviceStatus["kind"]> = new Set([
	DEVICE_STATUS.PENDING_APPROVAL,
	DEVICE_STATUS.APPROVED,
	DEVICE_STATUS.REVOKED,
	DEVICE_STATUS.BLOCKED,
])

// CAP-008-R04, CAP-008-R13
export function rememberRegistration(status: DeviceStatus): void {
	const answer = registrationAnswerOf(status)
	if (answer === undefined) {
		return
	}
	SecureStore.setItemAsync(DEVICE_REGISTERED_KEY, answer).catch((failure: unknown) =>
		console.warn("the registration of the device could not be stored", failure),
	)
}

function registrationAnswerOf(status: DeviceStatus): string | undefined {
	if (KNOWN_TO_SERVER.has(status.kind)) {
		return REGISTERED
	}
	return status.kind === DEVICE_STATUS.UNREGISTERED ? UNREGISTERED : undefined
}

// CAP-008-R04
export async function isDeviceRegistered(): Promise<boolean> {
	try {
		return (await SecureStore.getItemAsync(DEVICE_REGISTERED_KEY)) === REGISTERED
	} catch (failure) {
		console.warn("the registration of the device could not be read", failure)
		return true
	}
}

// CAP-006-R19, CAP-008-R13
export async function forgetRegistration(): Promise<void> {
	await SecureStore.setItemAsync(DEVICE_REGISTERED_KEY, UNREGISTERED)
}
