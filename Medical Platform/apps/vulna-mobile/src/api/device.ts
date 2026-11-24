import type { DeviceEvent, DeviceEventBatchReceipt, IntegrityReport, MobileContract } from "@ansora/contracts"
import type { DeviceRegistrationRequest, DeviceState, EnrolmentApi } from "@ansora/core-mobile"
import { rememberEffectiveConfiguration } from "../features/session/effective-configuration-store"
import { ACCEPTS_OUTDATED_APP, callApi, callApiResponse } from "./client"

const REGISTRATION_PATH: keyof MobileContract.paths = "/device/registration"
export const VERIFICATION_PATH: keyof MobileContract.paths = "/device/verification"
const EVENTS_PATH: keyof MobileContract.paths = "/device/events"
const INTEGRITY_PATH: keyof MobileContract.paths = "/device/integrity"

async function remembered(state: Promise<DeviceState>): Promise<DeviceState> {
	const received = await state
	rememberEffectiveConfiguration(received.effective_configuration)
	return received
}

export const deviceApi = {
	registerDevice: (request: DeviceRegistrationRequest): Promise<DeviceState> =>
		remembered(callApi<DeviceState>(REGISTRATION_PATH, { method: "POST", body: request })),
	verifyDevice: (): Promise<DeviceState> => remembered(callApi<DeviceState>(VERIFICATION_PATH, { method: "POST" })),
} satisfies EnrolmentApi

// CAP-025-R22, identity.yaml reportDeviceEvents
export function reportDeviceEvents(events: readonly DeviceEvent[]): Promise<DeviceEventBatchReceipt> {
	return callApi<DeviceEventBatchReceipt>(EVENTS_PATH, { method: "POST", body: { events }, ...ACCEPTS_OUTDATED_APP })
}

// CAP-008-R04, CAP-012-R24, identity.yaml reportDeviceIntegrity
export async function reportDeviceIntegrity(report: IntegrityReport): Promise<void> {
	await callApiResponse(INTEGRITY_PATH, { method: "POST", body: report, ...ACCEPTS_OUTDATED_APP })
}
