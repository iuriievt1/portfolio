import type { components } from "./generated/mobile"

type Schemas = components["schemas"]

export type DeviceEventType = Schemas["DeviceEvent"]["type"]

// CAP-025-R22, identity.yaml DeviceEvent
export const DEVICE_EVENT_TYPE = {
	LOCAL_DATA_DELETION: "local-data-deletion",
	AUTHORIZATION_ENDPOINT_MISMATCH: "authorization-endpoint-mismatch",
} as const satisfies Record<string, DeviceEventType>

export type LocalDataDeletionDetails = Schemas["LocalDataDeletionDetails"]

export type LocalDataDeletionReason = LocalDataDeletionDetails["reason"]

// CAP-007-R04, CAP-008-R06, CAP-026-R08
export const LOCAL_DATA_DELETION_REASON = {
	DEVICE_REVOCATION: "device_revocation",
	OS_MODIFICATION: "os_modification",
	LOCAL_COPY_EXPIRED: "local_copy_expired",
} as const satisfies Record<string, LocalDataDeletionReason>

export const LOCAL_DATA_DELETION_REASONS: readonly LocalDataDeletionReason[] = Object.values(LOCAL_DATA_DELETION_REASON)

export type AuthorizationEndpointMismatchDetails = Schemas["AuthorizationEndpointMismatchDetails"]

type DeviceEventCommon = Omit<Schemas["DeviceEvent"], "type" | "details">

export type LocalDataDeletionEvent = DeviceEventCommon & {
	type: typeof DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION
	details: LocalDataDeletionDetails
}

export type AuthorizationEndpointMismatchEvent = DeviceEventCommon & {
	type: typeof DEVICE_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH
	details: AuthorizationEndpointMismatchDetails
}

// identity.yaml DeviceEvent allOf
export type DeviceEvent = LocalDataDeletionEvent | AuthorizationEndpointMismatchEvent

export interface DeviceEventBatch {
	events: DeviceEvent[]
}

export type DeviceEventBatchReceipt = Schemas["DeviceEventBatchReceipt"]
