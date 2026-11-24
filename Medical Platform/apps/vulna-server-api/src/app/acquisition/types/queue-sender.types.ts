import type { Request } from "express"
import type { Device } from "../../device/types/device.types"
import type { CurrentSession } from "../../login/types/login.types"
import type { QUEUE_SENDER } from "../constants/queue-sender.constants"

// CAP-025-R17
export interface SenderSession {
	sessionId: string
	userId: string
}

// ADR-014, CAP-021-R29
export interface UploadPermission {
	acquisitionId: string
	fileKey: string
	deviceId: string
	senderSession: SenderSession | undefined
	sha256: string
}

export interface UploadPermissionRow {
	acquisition_id: string
	file_key: string
	device_id: string
	sender_session_id: string | null
	sender_user_id: string | null
	sha256: string
}

export interface IssuedUploadPermission {
	token: string
	expiresAt: Date
}

// CAP-002-R09, CAP-021-R13, CAP-025-R17, ADR-014
export type QueueSender =
	| { kind: typeof QUEUE_SENDER.USER; current: CurrentSession }
	| { kind: typeof QUEUE_SENDER.DEVICE; device: Device; operatorUserId: string }
	| { kind: typeof QUEUE_SENDER.UPLOAD_PERMISSION; device: Device; permission: UploadPermission }

export type QueueSenderRequest = Request & { queueSender?: QueueSender }
