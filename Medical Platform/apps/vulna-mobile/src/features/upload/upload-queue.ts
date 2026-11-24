import { PAGE_LIMIT_MAX } from "@ansora/contracts"
import {
	type BufferedFile,
	backgroundQueue,
	cryptoAndKeys,
	hpkeEnvelopeOf,
	RECONCILIATION,
	type Reconciliation,
	reconciliationsOf,
	removedElsewhereOf,
	SERVER_FILE_STATUS,
	type SealedCopy,
	type ServerHpkeKey,
	type StoredFile,
	serverHpkeKeyOf,
	serverOrderOf,
	type TransferBuffer,
	UPLOAD_STATE,
	UPLOAD_STEP,
	type UploadRequest,
	type UploadResult,
	uploadStepOf,
} from "@ansora/core-mobile"
import type { SealedFile, SealedPart } from "../../api/acquisition-file-parts"
import {
	type AcquisitionDraftFile,
	type AcquisitionFileAnnouncement,
	type AcquisitionFileAnnouncementReceipt,
	acquisitionFileApi,
	type FileReplacement,
	uploadPathOf,
} from "../../api/acquisition-files"
import type { AcquisitionDraft } from "../../api/acquisitions"
import { apiUrlOf } from "../../api/client"
import { deviceApi } from "../../api/device"
import { queueApi } from "../../api/queue"
import { forgetThumbnail } from "../../utils/thumbnail-cache"
import {
	keepUnlessForgotten,
	removeCapturedPhoto,
	replaceCapturedPhoto,
	showCapturedPhotos,
} from "../capture/capture-session"
import { isVersionConflict, retryAfterConflict } from "../capture/conflict-retry"
import { knownDraft, refreshDraft } from "../capture/draft-update"
import { deviceCaller } from "../device/device-caller"
import { sendPendingDeviceEvents } from "../device/device-events"
import { noteDeviceRevoked } from "../device/device-revocation-events"
import { effectiveConfiguration } from "../session/effective-configuration-store"
import { sessionCaller } from "../session/session-actions"
import { currentSession } from "../session/session-store"
import { onSessionTokenIssued } from "../session/session-token-events"
import { sendQueuedClosures, withdrawQueuedClosure } from "./closure-queue"
import { isChangedOnlyByUploads } from "./draft-files"
import { removeExpiredCopies } from "./local-copies"
import { markQueueChanged } from "./queue-changes"
import { forgetFileNotice, noteRejectedFile, noteSlowedFile, noteUnreadableFile } from "./queue-notices"
import { queueReportOf } from "./queue-report"
import { RetryTimers } from "./retry-timers"
import { receiptReconciliationsOf } from "./server-receipts"
import { QUEUE, reopenQueueStorage, transferBuffer } from "./transfer-store"
import { permittedUploadHeadersOf, uploadAnnouncementOf, uploadHeadersOf } from "./upload-announcement"
import {
	failureOutcomeOf,
	isStorageKeyLost,
	isUnreadableFile,
	REPLACEMENT_OUTCOME,
	type ReplacementOutcome,
	receiptOutcomeOf,
	replacementOutcomeOf,
	startsSlowedRetry,
	UPLOAD_OUTCOME,
	type UploadOutcome,
	uploadOutcomeOf,
} from "./upload-outcome"
import { uploadCollectionOf, uploadRequestOf } from "./upload-request"
import { isAwaitingServer } from "./waiting-files"

const NO_DELAY_MS = 0
// ADR-014, CAP-019-R32, CAP-025-R17
export const SESSION_ANNOUNCEMENT_GRACE_MS = 60_000

interface KeptSeal {
	sealed: SealedFile
	contentFileId: string
	serverKeyVersion: string
}

interface HandedOverFile {
	file: BufferedFile
	announcement: AcquisitionFileAnnouncement
}

const sending = new Set<string>()
const uploading = new Set<string>()
const retries = new RetryTimers()
const keptSeals = new Map<string, KeptSeal>()
let pumping = false
let pumpAgain = false
let isListening = false
let needsCatchUp = true
let isHalted = false
let pausedUntil = 0
let pauseTimer: ReturnType<typeof setTimeout> | undefined

// NAB-205, CAP-019-R02, CAP-019-R24
export function startUploadQueue(): void {
	listenToUploads()
	catchUpUploads()
}

// CAP-019-R24, CAP-009-R13
export function catchUpUploads(): void {
	needsCatchUp = true
	pumpUploads()
}

// CAP-019-R02, CAP-015-R30
export function pumpUploads(): void {
	if (isHalted) {
		return
	}
	if (pumping) {
		pumpAgain = true
		return
	}
	pumping = true
	run()
		.catch((failure: unknown) => console.warn("the upload queue stopped", failure))
		.finally(() => {
			pumping = false
			if (pumpAgain) {
				pumpAgain = false
				pumpUploads()
			}
		})
}

// CAP-014-R14, Figma 05 H.3
export function retryUploadsNow(): void {
	retries.restart()
	catchUpUploads()
}

// CAP-007-R04
export function stopUploadQueue(): void {
	isHalted = true
	retries.stopAll()
}

// CAP-006-S06
export function resumeUploadQueue(): void {
	if (!isHalted) {
		return
	}
	isHalted = false
	catchUpUploads()
}

// Figma 05 H.1, H.3
export function hasUploadsInFlight(): boolean {
	return sending.size + uploading.size > 0
}

// CAP-015-R35, CAP-015-R36, CAP-019-R24
export async function reconcileFiles(
	acquisitionId: string,
	serverFiles: readonly AcquisitionDraftFile[],
): Promise<BufferedFile[]> {
	const operatorUserId = currentSession()?.user.id
	if (operatorUserId === undefined) {
		return []
	}
	const buffer = await transferBuffer()
	for (const change of reconciliationsOf(await buffer.photos(acquisitionId, operatorUserId), serverFiles)) {
		await applyReconciliation(buffer, change)
		await showFile(buffer, change.fileKey)
	}
	for (const file of removedElsewhereOf(await buffer.photos(acquisitionId, operatorUserId), serverFiles)) {
		await forgetRemovedElsewhere(buffer, file)
	}
	await applyServerOrder(buffer, acquisitionId, operatorUserId, serverFiles)
	pumpUploads()
	return await buffer.photos(acquisitionId, operatorUserId)
}

// CAP-015-R18, CAP-021-R32, CAP-015-R35
async function forgetRemovedElsewhere(buffer: TransferBuffer, file: BufferedFile): Promise<void> {
	retries.forget(file.fileKey)
	await discardSeal(buffer, file.fileKey)
	await buffer.remove(file.fileKey)
	removeCapturedPhoto(file.acquisitionId, file.fileKey)
	forgetThumbnail(file.thumbnailFileId)
	markQueueChanged()
}

// CAP-019-R24
function listenToUploads(): void {
	if (isListening) {
		return
	}
	try {
		const queue = backgroundQueue()
		queue.addListener("uploadFinished", settleQuietly)
		queue.addListener("uploadFailed", settleQuietly)
		onSessionTokenIssued(catchUpUploads)
		isListening = true
	} catch (failure) {
		console.warn("the upload queue could not listen to the uploads", failure)
	}
}

// CAP-019-R04, CAP-019-S05, CAP-002-R13, CAP-019-R29
async function run(): Promise<void> {
	const buffer = await transferBuffer()
	if (needsCatchUp) {
		await catchUp(buffer)
		await takeServerReceipts(buffer)
		await removeExpiredCopies(buffer, isInFlight)
		await reportQueue(buffer)
		needsCatchUp = false
		void sendPendingDeviceEvents()
	}
	await pump(buffer)
	if (!isHalted) {
		sendQueuedClosures(buffer, pumpUploads).catch((failure: unknown) =>
			console.warn("the queued closures were not sent", failure),
		)
	}
}

// CAP-019-R24, CAP-009-R13
async function catchUp(buffer: TransferBuffer): Promise<void> {
	const queue = backgroundQueue()
	const pending = new Set(await queue.pending())
	uploading.clear()
	for (const fileKey of pending) {
		uploading.add(fileKey)
	}
	for (const result of await queue.takeResults()) {
		if (!pending.has(result.id)) {
			await settle(result)
		}
	}
	for (const file of await buffer.queued()) {
		if (isInFlight(file.fileKey) || keptSeals.has(file.fileKey)) {
			continue
		}
		await buffer.discardSealedCopies(file.fileKey)
		if (file.uploadState === UPLOAD_STATE.UPLOADING) {
			await buffer.markWaiting(file.fileKey)
		}
	}
}

// CAP-019-R24, CAP-019-R12, CAP-019-R30, CAP-026-R08
async function takeServerReceipts(buffer: TransferBuffer): Promise<void> {
	if (!(await buffer.queued()).some(isAwaitingServer)) {
		return
	}
	try {
		let cursor: string | undefined
		do {
			const page = await callWithAvailableToken((accessToken) =>
				queueApi.getQueueState(accessToken, PAGE_LIMIT_MAX, cursor),
			)
			for (const change of receiptReconciliationsOf(await buffer.queued(), page.items)) {
				await applyReconciliation(buffer, change)
				await showFile(buffer, change.fileKey)
			}
			cursor = page.next_cursor ?? undefined
		} while (cursor !== undefined && (await buffer.queued()).some(isAwaitingServer))
	} catch (failure) {
		console.warn("the files the server already received could not be read", failure)
	}
}

// CAP-019-R08, CAP-007-S08
async function reportQueue(buffer: TransferBuffer): Promise<void> {
	try {
		const report = queueReportOf(await buffer.queued(), new Date())
		await callWithAvailableToken((accessToken) => queueApi.reportQueueState(accessToken, report))
	} catch (failure) {
		console.warn("the state of the queue could not be reported", failure)
	}
}

// CAP-002-R09, CAP-019-R30
async function callWithAvailableToken<T>(work: (accessToken: string) => Promise<T>): Promise<T> {
	return currentSession() === undefined ? await deviceCaller.call(work) : await sessionCaller.call(work)
}

// NAB-205, NAB-412, ADR-014
async function pump(buffer: TransferBuffer): Promise<void> {
	const handedOver: HandedOverFile[] = []
	for (const file of await buffer.queued()) {
		if (isHalted) {
			return
		}
		if (isInFlight(file.fileKey) || retries.isResting(file.fileKey)) {
			continue
		}
		await advance(buffer, file, handedOver)
	}
	await announceInSessions(handedOver)
}

// CAP-019-R02, CAP-015-R34, CAP-019-R13
async function advance(buffer: TransferBuffer, file: BufferedFile, handedOver: HandedOverFile[]): Promise<void> {
	const step = uploadStepOf(file)
	switch (step) {
		case UPLOAD_STEP.SEND:
			if (announcesInBackground()) {
				await handOverToAnnounce(buffer, file, handedOver)
				return
			}
			if (!isPaused()) {
				await sendFile(buffer, file)
			}
			return
		case UPLOAD_STEP.REPLACE:
			if (!isPaused() && isSignedIn(file.operatorUserId)) {
				await replaceFile(buffer, file)
			}
			return
		case UPLOAD_STEP.NONE:
			return
		default:
			return step satisfies never
	}
}

// ADR-014
function announcesInBackground(): boolean {
	return backgroundQueue().announcesFiles === true
}

// NAB-205, NAB-412, ADR-014, CAP-019-R32, CAP-021-R21, ADR-015
async function handOverToAnnounce(
	buffer: TransferBuffer,
	file: BufferedFile,
	handedOver: HandedOverFile[],
): Promise<void> {
	const { fileKey } = file
	sending.add(fileKey)
	try {
		await discardSeal(buffer, fileKey)
		const sealed = await sealFile(buffer, file, await serverRecipient())
		const announcement = announcementOf(file, sealed)
		const isOwnerSignedIn = isSignedIn(file.operatorUserId)
		const request = uploadRequestOf({
			fileKey,
			kind: file.kind,
			sequence: file.position,
			url: uploadUrlOf(file),
			headers: uploadHeadersOf(fileKey),
			sealed,
			announcement: uploadAnnouncementOf({ ...file, announcement }),
			delayMs: isOwnerSignedIn ? SESSION_ANNOUNCEMENT_GRACE_MS : NO_DELAY_MS,
		})
		await handOver(buffer, file, request)
		if (isOwnerSignedIn) {
			handedOver.push({ file, announcement })
		}
	} catch (error) {
		uploading.delete(fileKey)
		await recordFailure(buffer, file, error)
	} finally {
		sending.delete(fileKey)
		await discardSeal(buffer, fileKey)
		await showFile(buffer, fileKey)
	}
}

// CAP-019-R32, CAP-025-R17, CAP-025-R26
async function announceInSessions(handedOver: readonly HandedOverFile[]): Promise<void> {
	for (const { file, announcement } of handedOver) {
		if (isHalted || isPaused()) {
			return
		}
		if (isSignedIn(file.operatorUserId)) {
			await announceInSession(file, announcement)
		}
	}
}

// CAP-019-R32, CAP-025-R17, CAP-019-R13
async function announceInSession(file: BufferedFile, announcement: AcquisitionFileAnnouncement): Promise<void> {
	try {
		const receipt = await announceAsOwner(file, announcement)
		if (receipt.file.status === SERVER_FILE_STATUS.ANNOUNCED) {
			await backgroundQueue().grant(file.fileKey, receipt.upload_permission)
		}
	} catch (error) {
		console.warn("the session did not announce the file; the system announces it", file.fileKey, error)
		const outcome = failureOutcomeOf(error)
		if (outcome.kind === UPLOAD_OUTCOME.RETRY) {
			pauseFor(outcome.retryAfterMs)
		}
	}
}

// CAP-015-R35, CAP-009-R13, CAP-021-R21, ADR-015
async function sendFile(buffer: TransferBuffer, file: BufferedFile): Promise<void> {
	const { fileKey } = file
	sending.add(fileKey)
	try {
		await deliver(buffer, file)
	} catch (error) {
		uploading.delete(fileKey)
		await recordFailure(buffer, file, error)
	} finally {
		sending.delete(fileKey)
		await showFile(buffer, fileKey)
	}
}

// ADR-014, CAP-015-R35
async function deliver(buffer: TransferBuffer, file: BufferedFile): Promise<void> {
	const sealed = await keptSealOf(buffer, file)
	const receipt = await announce(file, announcementOf(file, sealed))
	if (receipt.file.status !== SERVER_FILE_STATUS.ANNOUNCED) {
		await discardSeal(buffer, file.fileKey)
		await recordOutcome(buffer, file, receiptOutcomeOf(receipt.file.status))
		return
	}
	try {
		await handOver(
			buffer,
			file,
			uploadRequestOf({
				fileKey: file.fileKey,
				kind: file.kind,
				sequence: file.position,
				url: uploadUrlOf(file),
				headers: permittedUploadHeadersOf(file.fileKey, receipt.upload_permission),
				sealed,
				announcement: null,
				delayMs: NO_DELAY_MS,
			}),
		)
	} finally {
		await discardSeal(buffer, file.fileKey)
	}
}

// NAB-205, NAB-412, CAP-019-R01
async function handOver(buffer: TransferBuffer, file: BufferedFile, request: UploadRequest): Promise<void> {
	await buffer.markUploading(file)
	sending.delete(file.fileKey)
	uploading.add(file.fileKey)
	await backgroundQueue().upload(request)
}

// CAP-009-R13, CAP-021-R21
async function keptSealOf(buffer: TransferBuffer, file: BufferedFile): Promise<SealedFile> {
	const recipient = await serverRecipient()
	const kept = keptSeals.get(file.fileKey)
	const isCurrent =
		kept !== undefined &&
		kept.contentFileId === file.contentFileId &&
		kept.serverKeyVersion === recipient.serverKeyVersion
	if (isCurrent) {
		return kept.sealed
	}
	await discardSeal(buffer, file.fileKey)
	const sealed = await sealFile(buffer, file, recipient)
	keptSeals.set(file.fileKey, {
		sealed,
		contentFileId: file.contentFileId,
		serverKeyVersion: recipient.serverKeyVersion,
	})
	return sealed
}

// CAP-009-R13, NAB-159
async function discardSeal(buffer: TransferBuffer, fileKey: string): Promise<void> {
	keptSeals.delete(fileKey)
	await buffer.discardSealedCopies(fileKey)
}

// index.yaml FileIdempotencyKey, CAP-002-R09, CAP-025-R17, CAP-019-S05
async function announce(
	file: BufferedFile,
	announcement: AcquisitionFileAnnouncement,
): Promise<AcquisitionFileAnnouncementReceipt> {
	if (isSignedIn(file.operatorUserId)) {
		return await announceAsOwner(file, announcement)
	}
	const { acquisitionId, fileKey, operatorUserId } = file
	return await deviceCaller.call((deviceToken) =>
		acquisitionFileApi.announceAcquisitionFile(deviceToken, acquisitionId, fileKey, announcement, operatorUserId),
	)
}

// CAP-019-R32, CAP-025-R17
async function announceAsOwner(
	file: BufferedFile,
	announcement: AcquisitionFileAnnouncement,
): Promise<AcquisitionFileAnnouncementReceipt> {
	return await sessionCaller.call((sessionToken) =>
		acquisitionFileApi.announceAcquisitionFile(sessionToken, file.acquisitionId, file.fileKey, announcement, undefined),
	)
}

// CAP-015-R35, CAP-015-R36, CAP-019-S12
function announcementOf(file: BufferedFile, sealed: SealedFile): AcquisitionFileAnnouncement {
	const announcement = { file_kind: file.kind, sha256: sealed.sha256 }
	return file.replacesFileKey === null ? announcement : { ...announcement, replaces_file_key: file.replacesFileKey }
}

// clinical-workflow.yaml uploadImage, uploadDocumentPage
function uploadUrlOf(file: BufferedFile): string {
	return apiUrlOf(uploadPathOf(file.acquisitionId, uploadCollectionOf(file.kind)))
}

// CAP-021-R21, CAP-019-S05
async function serverRecipient(): Promise<ServerHpkeKey> {
	const serverKey = (effectiveConfiguration() ?? (await verifiedConfiguration()))?.server_hpke_key
	if (serverKey === undefined || serverKey === null) {
		throw new Error("the configuration carries no server key")
	}
	return serverHpkeKeyOf(serverKey)
}

// CAP-009-R13, NAB-159, CAP-021-R21
async function sealFile(buffer: TransferBuffer, file: BufferedFile, recipient: ServerHpkeKey): Promise<SealedFile> {
	const content = await sealStored(buffer, file.fileKey, await buffer.content(file), recipient)
	const thumbnail = await sealStored(buffer, file.fileKey, await buffer.storedThumbnail(file), recipient)
	return { file: sealedPartOf(content), thumbnail: sealedPartOf(thumbnail), sha256: content.sha256 }
}

// CAP-009-R13
async function sealStored(
	buffer: TransferBuffer,
	fileKey: string,
	stored: StoredFile,
	recipient: ServerHpkeKey,
): Promise<SealedCopy> {
	const sealed = await cryptoAndKeys().sealForServer(stored.path, stored.wrappedKey, QUEUE, recipient)
	await buffer.keepSealedCopy(fileKey, sealed)
	return sealed
}

// CAP-019-S05
async function verifiedConfiguration() {
	await deviceApi.verifyDevice()
	return effectiveConfiguration()
}

// CAP-021-R21
function sealedPartOf(copy: SealedCopy): SealedPart {
	return { path: copy.path, envelope: hpkeEnvelopeOf(copy) }
}

// CAP-015-R34, CAP-015-S56, CAP-021-R34
async function replaceFile(buffer: TransferBuffer, file: BufferedFile): Promise<void> {
	const { fileKey } = file
	const edit = file.contentEdit
	if (edit === null) {
		console.warn("the buffer does not know the edit of the file", fileKey)
		await buffer.markEditFailed(file, null)
		await showFile(buffer, fileKey)
		return
	}
	sending.add(fileKey)
	try {
		await discardSeal(buffer, fileKey)
		const sealed = await sealFile(buffer, file, await serverRecipient())
		await sendReplacement(file, { ...sealed, edit })
		retries.forget(fileKey)
		await buffer.markReceived(fileKey, file.contentFileId)
		await forgetFileNotice(fileKey)
	} catch (error) {
		await recordReplacementFailure(buffer, file, error)
	} finally {
		sending.delete(fileKey)
		await discardSeal(buffer, fileKey)
		await showFile(buffer, fileKey)
	}
}

// CAP-021-R32, E115
async function sendReplacement(file: BufferedFile, replacement: FileReplacement): Promise<void> {
	const known = await knownDraft(file.acquisitionId)
	await retryAfterConflict(known, (draft) => replaceOnServer(draft, file.fileKey, replacement), {
		isConflict: isVersionConflict,
		refresh: () => refreshDraft(file.acquisitionId),
		isRetryable: async (fresh) => isChangedOnlyByUploads(known, fresh, await bufferedKeysOf(file)),
	})
}

async function replaceOnServer(draft: AcquisitionDraft, fileKey: string, replacement: FileReplacement): Promise<void> {
	await sessionCaller.call((sessionToken) =>
		acquisitionFileApi.replaceAcquisitionFile(sessionToken, draft, fileKey, replacement),
	)
}

async function bufferedKeysOf(file: BufferedFile): Promise<string[]> {
	const buffered = await (await transferBuffer()).photos(file.acquisitionId, file.operatorUserId)
	return buffered.map((candidate) => candidate.fileKey)
}

// CAP-015-R34, CAP-021-R32, CAP-009-S05, E115, Q-076
async function recordReplacementFailure(buffer: TransferBuffer, file: BufferedFile, error: unknown): Promise<void> {
	if (isStorageKeyLost(error)) {
		await reopenWithoutKey(file, error)
		return
	}
	if (isUnreadableFile(error)) {
		console.warn("the edited file cannot be read; the server keeps the earlier one", file.fileKey, error)
		retries.forget(file.fileKey)
		await buffer.markEditFailed(file, null)
		return
	}
	await recordReplacementOutcome(buffer, file, replacementOutcomeOf(error))
}

// CAP-015-R34, CAP-021-R32, E115
async function recordReplacementOutcome(
	buffer: TransferBuffer,
	file: BufferedFile,
	outcome: ReplacementOutcome,
): Promise<void> {
	switch (outcome.kind) {
		case REPLACEMENT_OUTCOME.RETRY:
			rest(file, outcome.retryAfterMs)
			pauseFor(outcome.retryAfterMs)
			return
		case REPLACEMENT_OUTCOME.EDIT_REFUSED:
			retries.forget(file.fileKey)
			await buffer.markEditFailed(file, outcome.code)
			await forgetFileNotice(file.fileKey)
			return
		case REPLACEMENT_OUTCOME.REVOKED:
			halt()
			return
		default:
			return outcome satisfies never
	}
}

function settleQuietly(result: UploadResult): void {
	settle(result).catch((failure: unknown) => console.warn("an upload could not be settled", failure))
}

// ADR-015, CAP-019-R21, CAP-009-R13
async function settle(result: UploadResult): Promise<void> {
	const fileKey = result.id
	uploading.delete(fileKey)
	if (sending.has(fileKey)) {
		return
	}
	const buffer = await transferBuffer()
	await discardSeal(buffer, fileKey)
	const file = await buffer.find(fileKey)
	if (file?.uploadState === UPLOAD_STATE.UPLOADING) {
		await recordOutcome(buffer, file, uploadOutcomeOf(result))
		await showFile(buffer, fileKey)
	}
	pumpUploads()
}

// CAP-019-R14, CAP-019-R13, CAP-009-S05, CAP-009-R13, Q-076
async function recordFailure(buffer: TransferBuffer, file: BufferedFile, error: unknown): Promise<void> {
	if (isStorageKeyLost(error)) {
		await reopenWithoutKey(file, error)
		return
	}
	if (isUnreadableFile(error)) {
		await recordUnreadable(buffer, file, error)
		return
	}
	const outcome = failureOutcomeOf(error)
	if (outcome.kind !== UPLOAD_OUTCOME.RETRY) {
		await discardSeal(buffer, file.fileKey)
	}
	await recordOutcome(buffer, file, outcome)
}

// CAP-009-S05, ADR-038, Q-076
async function reopenWithoutKey(file: BufferedFile, error: unknown): Promise<void> {
	console.warn("the queue key no longer opens the queue; the queue opens again", file.fileKey, error)
	await reopenQueueStorage()
	markQueueChanged()
	pumpUploads()
}

// CAP-009-S05, CAP-019-R25, ADR-038, Q-076
async function recordUnreadable(buffer: TransferBuffer, file: BufferedFile, error: unknown): Promise<void> {
	console.warn("the file cannot be read; it stays on the device and is not sent", file.fileKey, error)
	retries.forget(file.fileKey)
	await discardSeal(buffer, file.fileKey)
	await buffer.markUnreadable(file)
	const current = await buffer.find(file.fileKey)
	if (current?.uploadState === UPLOAD_STATE.UNREADABLE) {
		await noteUnreadableFile(current, await withdrawQueuedClosure(current.acquisitionId))
	}
}

// CAP-019-R14, CAP-019-R18, CAP-019-R24, CAP-007-R11
async function recordOutcome(buffer: TransferBuffer, file: BufferedFile, outcome: UploadOutcome): Promise<void> {
	const current = await buffer.find(file.fileKey)
	if (current === undefined) {
		retries.forget(file.fileKey)
		return
	}
	switch (outcome.kind) {
		case UPLOAD_OUTCOME.RECEIVED:
		case UPLOAD_OUTCOME.LATE:
			retries.forget(file.fileKey)
			await buffer.markReceived(file.fileKey, current.sentContentFileId ?? current.contentFileId)
			await forgetFileNotice(file.fileKey)
			return
		case UPLOAD_OUTCOME.REJECTED:
			retries.forget(file.fileKey)
			await buffer.markRejected(file.fileKey, outcome.code)
			await noteRejectedFile(current, outcome.code, await withdrawQueuedClosure(current.acquisitionId))
			return
		case UPLOAD_OUTCOME.RETRY:
			await buffer.markWaiting(file.fileKey)
			rest(file, outcome.retryAfterMs)
			pauseFor(outcome.retryAfterMs)
			return
		case UPLOAD_OUTCOME.REVOKED:
			await buffer.markWaiting(file.fileKey)
			halt()
			return
		default:
			return outcome satisfies never
	}
}

// CAP-015-R35, CAP-015-R36, CAP-009-R13, CAP-019-R25
async function applyReconciliation(buffer: TransferBuffer, change: Reconciliation): Promise<void> {
	retries.forget(change.fileKey)
	if (!isInFlight(change.fileKey)) {
		await discardSeal(buffer, change.fileKey)
	}
	if (change.kind === RECONCILIATION.RECEIVED) {
		await buffer.markReceived(change.fileKey, change.contentFileId)
		await forgetFileNotice(change.fileKey)
		return
	}
	await buffer.markRejected(change.fileKey, null)
	const rejected = await buffer.find(change.fileKey)
	if (rejected !== undefined) {
		await noteRejectedFile(rejected, null, await withdrawQueuedClosure(rejected.acquisitionId))
	}
}

// CAP-015-R35, CAP-018-R11
async function applyServerOrder(
	buffer: TransferBuffer,
	acquisitionId: string,
	operatorUserId: string,
	serverFiles: readonly AcquisitionDraftFile[],
): Promise<void> {
	const order = serverOrderOf(await buffer.photos(acquisitionId, operatorUserId), serverFiles)
	if (order === undefined) {
		return
	}
	await keepUnlessForgotten(
		async () => {
			await buffer.reorder(acquisitionId, order)
			return await buffer.photos(acquisitionId, operatorUserId)
		},
		(photos) => showCapturedPhotos(acquisitionId, photos),
	)
}

// CAP-019-R18, CAP-019-R25, RFC 9110
function rest(file: BufferedFile, retryAfterMs: number | undefined): void {
	const attempt = retries.rest(file.fileKey, retryAfterMs, pumpUploads)
	if (startsSlowedRetry(attempt)) {
		noteSlowedFile(file).catch((failure: unknown) =>
			console.warn("the slowed upload could not be noted", file.fileKey, failure),
		)
	}
}

// CAP-019-R13, RFC 9110
function pauseFor(retryAfterMs: number | undefined): void {
	if (retryAfterMs === undefined) {
		return
	}
	const until = Date.now() + retryAfterMs
	if (until <= pausedUntil) {
		return
	}
	pausedUntil = until
	clearTimeout(pauseTimer)
	pauseTimer = setTimeout(() => {
		pauseTimer = undefined
		pumpUploads()
	}, retryAfterMs)
}

function isPaused(): boolean {
	return Date.now() < pausedUntil
}

// NAB-503–505, CAP-007-R11, CAP-019-R14
function halt(): void {
	console.warn("the server revoked this device; the upload queue stops")
	stopUploadQueue()
	noteDeviceRevoked()
}

function isInFlight(fileKey: string): boolean {
	return sending.has(fileKey) || uploading.has(fileKey)
}

// CAP-021-R13, CAP-015-R17
function isSignedIn(operatorUserId: string): boolean {
	return currentSession()?.user.id === operatorUserId
}

// CAP-015-R10, CAP-019-R23
async function showFile(buffer: TransferBuffer, fileKey: string): Promise<void> {
	markQueueChanged()
	const file = await buffer.find(fileKey)
	if (file !== undefined && isSignedIn(file.operatorUserId)) {
		replaceCapturedPhoto(file.acquisitionId, file)
	}
}
