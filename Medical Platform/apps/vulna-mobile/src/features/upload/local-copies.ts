import { type DeviceEvent, LOCAL_DATA_DELETION_REASON } from "@ansora/contracts"
import { type BufferedFile, type DeletedItems, localDataDeletionEvent, type TransferBuffer } from "@ansora/core-mobile"
import { randomUuid } from "../../utils/random-uuid"
import { forgetThumbnail } from "../../utils/thumbnail-cache"
import { millisecondsOf } from "../../utils/time"
import { removeCapturedPhoto } from "../capture/capture-session"
import { recordDeviceEvents } from "../device/device-events"
import { localCopyRetentionSeconds } from "./local-copy-retention"
import { markQueueChanged } from "./queue-changes"

type DeletedCopy = Pick<BufferedFile, "operatorUserId" | "capturedAt">

// CAP-026-R08, CAP-026-R10, CAP-026-S04, CAP-026-S12, CAP-009-R18
export async function removeExpiredCopies(
	buffer: TransferBuffer,
	isInFlight: (fileKey: string) => boolean,
): Promise<void> {
	try {
		const retentionSeconds = await localCopyRetentionSeconds()
		if (retentionSeconds === undefined) {
			return
		}
		const now = new Date()
		const receivedBefore = new Date(now.getTime() - millisecondsOf(retentionSeconds))
		const expired = (await buffer.expiredCopies(receivedBefore)).filter((file) => !isInFlight(file.fileKey))
		if (expired.length === 0) {
			return
		}
		const removed: BufferedFile[] = []
		try {
			for (const file of expired) {
				await buffer.remove(file.fileKey)
				removed.push(file)
				removeCapturedPhoto(file.acquisitionId, file.fileKey)
				forgetThumbnail(file.thumbnailFileId)
			}
		} finally {
			await reportRemoved(removed, now)
		}
	} catch (failure) {
		console.warn("the expired local copies could not be removed", failure)
	}
}

// CAP-026-R10
async function reportRemoved(removed: readonly BufferedFile[], now: Date): Promise<void> {
	if (removed.length === 0) {
		return
	}
	await recordDeviceEvents(await deletionEventsOf(removed, now))
	markQueueChanged()
}

// CAP-026-R10, identity.yaml LocalDataDeletionDetails
export function deletedCopiesByOperator(copies: readonly DeletedCopy[]): Map<string, DeletedItems> {
	const byOperator = new Map<string, DeletedItems>()
	for (const copy of copies) {
		const counted = byOperator.get(copy.operatorUserId)
		byOperator.set(copy.operatorUserId, {
			count: (counted?.count ?? 0) + 1,
			oldestAcquiredAt: earlierOf(counted?.oldestAcquiredAt ?? null, copy.capturedAt),
		})
	}
	return byOperator
}

async function deletionEventsOf(copies: readonly DeletedCopy[], now: Date): Promise<DeviceEvent[]> {
	const events: DeviceEvent[] = []
	for (const [operatorUserId, deleted] of deletedCopiesByOperator(copies)) {
		events.push(
			localDataDeletionEvent(
				await randomUuid(),
				now,
				operatorUserId,
				LOCAL_DATA_DELETION_REASON.LOCAL_COPY_EXPIRED,
				deleted,
			),
		)
	}
	return events
}

function earlierOf(current: string | null, candidate: string): string {
	return current === null || Date.parse(candidate) < Date.parse(current) ? candidate : current
}
