import {
	cryptoAndKeys,
	type EncryptedStorage,
	type KeyDomain,
	openEncryptedStorage,
	type QueuedClosureRecords,
	type QueueNoticeRecords,
	type StorageLossRecords,
	type TransferBuffer,
} from "@ansora/core-mobile"

// CAP-009-R06, CAP-009-R17
export const QUEUE: KeyDomain = "queue"

let storage: Promise<EncryptedStorage> | undefined

function queueStorage(): Promise<EncryptedStorage> {
	storage ??= openEncryptedStorage(QUEUE, cryptoAndKeys()).catch((failure: unknown) => {
		storage = undefined
		throw failure
	})
	return storage
}

// CAP-009-S05, ADR-038, Q-076
export async function reopenQueueStorage(): Promise<void> {
	const opened = storage
	storage = undefined
	if (opened === undefined) {
		return
	}
	try {
		await (await opened).close()
	} catch (failure) {
		console.warn("the queue storage could not be closed before it opens again", failure)
	}
}

// CAP-009-R17
export async function transferBuffer(): Promise<TransferBuffer> {
	return (await queueStorage()).buffer
}

// CAP-019-R10, CAP-019-R29
export async function queuedClosures(): Promise<QueuedClosureRecords> {
	return (await queueStorage()).closures
}

// CAP-019-R25
export async function queueNotices(): Promise<QueueNoticeRecords> {
	return (await queueStorage()).notices
}

// CAP-009-S05, Q-076
export async function storageLosses(): Promise<StorageLossRecords> {
	return (await queueStorage()).losses
}
