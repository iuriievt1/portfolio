import type { CryptoAndKeys } from "../native"
import {
	DEVICE_STATUS,
	type DeviceStateValue,
	type DeviceStatus,
	deviceStatusOfProblem,
	deviceStatusOfState,
	type ProblemLike,
} from "./device-status"
import { createRegistrationRequest, type DeviceRegistrationRequest } from "./registration"

export type EnrolmentKeys = Pick<
	CryptoAndKeys,
	"deviceKey" | "deviceDescriptor" | "signJws" | "randomIdentifier" | "approvalFingerprint"
>

export interface DeviceStateResponse {
	state: DeviceStateValue
}

export interface EnrolmentApi {
	verifyDevice(): Promise<DeviceStateResponse>
	registerDevice(request: DeviceRegistrationRequest): Promise<DeviceStateResponse>
}

export interface ManagedEnrolment {
	registrationSecret?: string
	groupCode?: string
	blockedPredecessorHwId?: string
}

export async function currentDeviceStatus(api: EnrolmentApi, keys: EnrolmentKeys): Promise<DeviceStatus> {
	return await withFingerprint(keys, await statusOf(() => api.verifyDevice()))
}

export async function enrolDevice(
	api: EnrolmentApi,
	keys: EnrolmentKeys,
	managed: ManagedEnrolment = {},
): Promise<DeviceStatus> {
	const { secureHardware } = await keys.deviceKey()
	const descriptor = await keys.deviceDescriptor()
	const request = await createRegistrationRequest(keys, {
		descriptor,
		secureHardware,
		managedConfiguration: managed.registrationSecret !== undefined,
		registrationSecret: managed.registrationSecret,
		groupCode: managed.groupCode,
		blockedPredecessorHwId: managed.blockedPredecessorHwId,
	})
	return await withFingerprint(keys, await statusOf(() => api.registerDevice(request)))
}

/** A lost network arrives as a plain error with no code, so anything unrecognised reads as no connection. */
async function statusOf(call: () => Promise<DeviceStateResponse>): Promise<DeviceStatus> {
	try {
		return deviceStatusOfState((await call()).state)
	} catch (failure) {
		return deviceStatusOfProblem(failure as ProblemLike)
	}
}

async function withFingerprint(keys: EnrolmentKeys, status: DeviceStatus): Promise<DeviceStatus> {
	if (status.kind !== DEVICE_STATUS.PENDING_APPROVAL) {
		return status
	}
	return { ...status, fingerprint: await keys.approvalFingerprint() }
}
