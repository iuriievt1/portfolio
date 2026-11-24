import type { AdministrationContract, IntegritySignal } from "@ansora/contracts"
import type { DeviceState, ExplicitOverrides, LoginMethodOverrides, PublicKeyJwk } from "@ansora/core-server"

export type DeviceView = AdministrationContract.components["schemas"]["Device"]

export type DevicesPage = AdministrationContract.components["schemas"]["DevicesPage"]

export type DeviceGroupView = AdministrationContract.components["schemas"]["DeviceGroup"]

export type DeviceGroupSaveResult = AdministrationContract.components["schemas"]["DeviceGroupSaveResult"]

export type DeviceSaveResult = AdministrationContract.components["schemas"]["DeviceSaveResult"]

export type BlockingReviewView = AdministrationContract.components["schemas"]["BlockingReview"]

export interface DeviceDetailRow {
	id: string
	state: DeviceState
	public_key_jwk: PublicKeyJwk
	hw_id: string
	model: string
	os_version: string
	platform: string
	managed_configuration: boolean
	group_code: string | null
	blocked_predecessor_hw_id: string | null
	last_contact_at: Date | null
	login_methods: LoginMethodOverrides
	registered_at: Date
	queue_waiting_count: number | null
	queue_failed_count: number | null
	queue_oldest_acquired_at: Date | null
	queue_detected_at: Date | null
	queue_reported_at: Date | null
	blocking_detected_at: Date | null
	blocking_signals: IntegritySignal[] | null
	blocking_app_version: string | null
	unblocked_at: Date | null
	unblocked_by_user_id: string | null
	unblock_reason: string | null
	predecessor_id: string | null
	predecessor_blocking_detected_at: Date | null
	predecessor_blocking_signals: IntegritySignal[] | null
	predecessor_blocking_app_version: string | null
}

export type DeviceQueueView = NonNullable<DeviceView["queue"]>

export interface DevicePageRow extends DeviceDetailRow {
	cursor_moment: string
}

export interface DeviceGroupRow {
	id: string
	code: string
	name: string
	login_methods: LoginMethodOverrides
	device_count: string
}

export interface DeviceOverridesRow {
	id: string
	hw_id: string
	login_methods: LoginMethodOverrides
}

export interface DevicePage {
	rows: DevicePageRow[]
	hasMore: boolean
}

export interface DevicePageQuery {
	limit: number
	cursor: string | undefined
	state: DeviceState | undefined
}

export interface NewDeviceGroup {
	code: string
	name: string
	loginMethods: ExplicitOverrides
}

// CAP-008-R12
export interface DeviceBlocking {
	detectedAt: string
	signals: readonly IntegritySignal[]
	appVersion: string
}

// CAP-007-R06, CAP-007-S07
export interface DeviceUnblocking {
	unblockedAt: Date
	administratorUserId: string
	reason: string
}

// CAP-002-R10
export interface EndedSessionRow {
	id: string
	user_id: string | null
}
