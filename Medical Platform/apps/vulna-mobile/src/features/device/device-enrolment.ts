import {
	cryptoAndKeys,
	DEVICE_STATUS,
	type DeviceStatus,
	enrolDevice,
	MANAGED_ENROLMENT_KEYS,
	type ManagedEnrolment,
	managedConfiguration,
	readManagedEnrolment,
} from "@ansora/core-mobile"
import { deviceApi } from "../../api/device"
import { blockedPredecessor } from "./block-markers"
import { rememberRegistration } from "./device-registration"

// CAP-006-R05, CAP-006-R06, CAP-006-R19, CAP-006-S13
export async function enrolThisDevice(): Promise<DeviceStatus> {
	const predecessor = await readablePredecessor()
	if (predecessor === undefined) {
		return { kind: DEVICE_STATUS.UNREACHABLE }
	}
	const status = await enrolDevice(deviceApi, cryptoAndKeys(), { ...(await managedEnrolment()), ...predecessor })
	rememberRegistration(status)
	return status
}

// CAP-006-R19
async function readablePredecessor(): Promise<ManagedEnrolment | undefined> {
	try {
		return await blockedPredecessor()
	} catch (failure) {
		console.warn("the marker of the blocked predecessor could not be read", failure)
		return undefined
	}
}

/**
 * A phone without MDM answers with nothing at all. An answer that cannot be read must not stop
 * the registration either — the device then registers as unmanaged and waits for the administrator.
 */
async function managedEnrolment(): Promise<ManagedEnrolment> {
	try {
		return readManagedEnrolment(await managedConfiguration().read(), MANAGED_ENROLMENT_KEYS)
	} catch (failure) {
		console.warn("managed configuration could not be read", failure)
		return {}
	}
}
