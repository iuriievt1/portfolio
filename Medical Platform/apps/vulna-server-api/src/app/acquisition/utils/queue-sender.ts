import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import type { Device } from "../../device/types/device.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { signInAgain } from "../../login/utils/login-rejection"
import { QUEUE_SENDER } from "../constants/queue-sender.constants"
import type { RejectedContentError } from "../errors/rejected-content.error"
import type { AcquisitionRow } from "../types/acquisition.types"
import type { FileUpload } from "../types/acquisition-file.types"
import type { QueueSender, SenderSession } from "../types/queue-sender.types"
import { notFound } from "./acquisition-problems"

export function senderDeviceOf(sender: QueueSender): Device {
	return sender.kind === QUEUE_SENDER.USER ? sender.current.device : sender.device
}

// CAP-025-R17
export function senderSessionOf(sender: QueueSender): SenderSession | undefined {
	switch (sender.kind) {
		case QUEUE_SENDER.USER:
			return { sessionId: sender.current.session.id, userId: sender.current.session.userId }
		case QUEUE_SENDER.DEVICE:
			return undefined
		case QUEUE_SENDER.UPLOAD_PERMISSION:
			return sender.permission.senderSession
		default:
			return sender satisfies never
	}
}

// CAP-015-R17, CAP-002-R09, CAP-002-S33, ADR-014
export function sentRecordOf(row: AcquisitionRow | undefined, sender: QueueSender): AcquisitionRow | undefined {
	if (row === undefined) {
		return undefined
	}
	switch (sender.kind) {
		case QUEUE_SENDER.USER:
			if (row.operator_user_id !== sender.current.session.userId) {
				throw notFound()
			}
			return row
		case QUEUE_SENDER.DEVICE:
			if (row.operator_user_id !== sender.operatorUserId) {
				throw new ProblemException(HttpStatus.FORBIDDEN, ERROR_CODE.RECORD_REJECTED)
			}
			return row
		case QUEUE_SENDER.UPLOAD_PERMISSION:
			if (row.id !== sender.permission.acquisitionId) {
				throw signInAgain()
			}
			return row
		default:
			return sender satisfies never
	}
}

// ADR-014
export function requirePermittedUpload(sender: QueueSender, upload: FileUpload): void {
	if (sender.kind !== QUEUE_SENDER.UPLOAD_PERMISSION) {
		return
	}
	const { permission } = sender
	const isPermitted =
		permission.acquisitionId === upload.acquisitionId &&
		permission.fileKey === upload.fileKey &&
		permission.sha256 === upload.sha256
	if (!isPermitted) {
		throw signInAgain()
	}
}

// ADR-014, CAP-019-R32
export function isForeignToPermission(sender: QueueSender, rejection: RejectedContentError): boolean {
	return sender.kind === QUEUE_SENDER.UPLOAD_PERMISSION && !rejection.isAnnouncedFile
}
