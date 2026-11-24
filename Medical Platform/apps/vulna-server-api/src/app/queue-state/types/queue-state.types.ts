import type { MobileContract } from "@ansora/contracts"
import type { AcquisitionState } from "@ansora/vulna-domain"
import type { Request } from "express"
import type { Device } from "../../device/types/device.types"
import type { CurrentSession } from "../../login/types/login.types"
import type { QUEUE_CALLER } from "../constants/queue-state.constants"

type MobileSchemas = MobileContract.components["schemas"]

export type AcquisitionStateView = MobileSchemas["AcquisitionState"]
export type QueueStatesPageView = MobileSchemas["QueueStatesPage"]

// CAP-002-R09, CAP-019-R30
export type QueueCaller =
	| { kind: typeof QUEUE_CALLER.USER; current: CurrentSession }
	| { kind: typeof QUEUE_CALLER.DEVICE; device: Device }

export type QueueCallerRequest = Request & { queueCaller?: QueueCaller }

// CAP-019-R30
export interface QueueStateScope {
	deviceId: string
	operatorUserId: string | undefined
	acquisitionKeys: readonly string[] | undefined
}

// CAP-019-R08
export interface QueueReport {
	waiting: number
	failed: number
	oldestAcquiredAt: Date | undefined
	detectedAt: Date
}

export interface QueueStateRow {
	id: string
	idempotency_key: string
	state: AcquisitionState
	cursor_moment: string
}
