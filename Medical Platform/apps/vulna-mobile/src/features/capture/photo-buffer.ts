import {
	type BufferedFile,
	camera,
	FILE_EDIT,
	type FileEdit,
	type PhotoCrop,
	type SecuredPage,
	type SecuredPhoto,
} from "@ansora/core-mobile"
import { forgetThumbnail } from "../../utils/thumbnail-cache"
import { cancelQueuedClosure } from "../upload/closure-queue"
import { markQueueChanged } from "../upload/queue-changes"
import { transferBuffer } from "../upload/transfer-store"
import { pumpUploads } from "../upload/upload-queue"
import {
	addCapturedPhoto,
	keepUnlessForgotten,
	removeCapturedPhoto,
	replaceCapturedPhoto,
	showCapturedPhotos,
} from "./capture-session"

const QUARTER_TURN = 1

export interface PhotoOwner {
	acquisitionId: string
	operatorUserId: string
}

type PhotoEdit = (path: string, wrappedKey: string) => Promise<SecuredPhoto>

type ShotLoss = (error: unknown) => void

// CAP-015-R36, CAP-019-S12
export interface KeptShot {
	owner: PhotoOwner
	fileKey: string
	replacedKey: string | null
}

let keeping: Promise<unknown> = Promise.resolve()

// CAP-015-S04, CAP-015-S08
export async function loadCapturedPhotos(owner: PhotoOwner): Promise<void> {
	await keepUnlessForgotten(
		async () => (await transferBuffer()).photos(owner.acquisitionId, owner.operatorUserId),
		(photos) => showCapturedPhotos(owner.acquisitionId, photos),
	)
}

// CAP-015-R14, CAP-015-R06, CAP-009-R09, CAP-015-R30, CAP-019-R29, CAP-015-R36, CAP-019-S12, E17, E18
export async function keepCapturedPhoto(shot: KeptShot, photo: Uint8Array, onLost: ShotLoss): Promise<void> {
	const { owner, fileKey, replacedKey } = shot
	await inShotOrder(async () => {
		await keepUnlessForgotten(
			async () => {
				const buffer = await transferBuffer()
				const secured = await camera().securePhoto(photo)
				return await buffer.addPhoto({ ...owner, fileKey }, secured, replacedKey)
			},
			(kept) => addCapturedPhoto(owner.acquisitionId, kept),
		)
		await cancelQueuedClosure(owner.acquisitionId)
		pumpUploads()
	}, onLost)
}

// CAP-018-R08, CAP-018-R11, CAP-019-R29, CAP-015-R36, CAP-019-S12, E17, E18
export async function keepScannedPage(
	shot: KeptShot,
	scan: () => Promise<SecuredPage>,
	onKept: (page: BufferedFile) => void,
	onLost: ShotLoss,
): Promise<void> {
	const { owner, fileKey, replacedKey } = shot
	await inShotOrder(async () => {
		const kept = await keepUnlessForgotten(
			async () => {
				const page = await scan()
				return await (await transferBuffer()).addPage({ ...owner, fileKey }, page, replacedKey)
			},
			(added) => addCapturedPhoto(owner.acquisitionId, added),
		)
		onKept(kept)
		await cancelQueuedClosure(owner.acquisitionId)
		pumpUploads()
	}, onLost)
}

// CAP-015-R33, CAP-018-R11
export async function whenShotsKept(): Promise<void> {
	await keeping
}

// CAP-015-R33, CAP-018-R11, E17, E18
function inShotOrder(work: () => Promise<void>, onLost: ShotLoss): Promise<void> {
	const next = keeping.then(work).catch(onLost)
	keeping = next.catch(() => undefined)
	return next
}

// CAP-015-R18, CAP-009-R18, CAP-026-R17, CAP-019-R14, CAP-019-S12, ADR-038, Q-076
export async function forgetCapturedPhoto(acquisitionId: string, photo: BufferedFile): Promise<void> {
	await keepUnlessForgotten(
		async () => (await transferBuffer()).removeFromRecord(photo.fileKey),
		() => removeCapturedPhoto(acquisitionId, photo.fileKey),
	)
	forgetThumbnail(photo.thumbnailFileId)
	markQueueChanged()
}

// CAP-015-R34
export async function rotateCapturedPhoto(acquisitionId: string, photo: BufferedFile): Promise<void> {
	await editCapturedPhoto(
		acquisitionId,
		photo,
		(path, wrappedKey) => camera().rotatePhoto(path, wrappedKey, QUARTER_TURN),
		FILE_EDIT.ROTATION,
	)
}

// CAP-015-R34, CAP-015-R03
export async function cropCapturedPhoto(acquisitionId: string, photo: BufferedFile, crop: PhotoCrop): Promise<void> {
	await editCapturedPhoto(
		acquisitionId,
		photo,
		(path, wrappedKey) => camera().cropPhoto(path, wrappedKey, crop),
		FILE_EDIT.CROP,
	)
}

// CAP-018-R11, CAP-015-R34, CAP-019-R29
export async function recropScannedPage(
	acquisitionId: string,
	page: BufferedFile,
	edit: FileEdit,
	recrop: (original: { path: string; wrappedKey: string }) => Promise<SecuredPhoto & { corners: string | null }>,
): Promise<void> {
	await keepUnlessForgotten(
		async () => {
			const buffer = await transferBuffer()
			const original = await buffer.original(page)
			if (original === undefined) {
				throw new Error("the page keeps no original")
			}
			const cropped = await recrop({ path: original.path, wrappedKey: original.wrappedKey })
			return await buffer.replacePage(page.fileKey, cropped, cropped.corners, edit)
		},
		(edited) => replaceCapturedPhoto(acquisitionId, edited),
	)
	forgetThumbnail(page.thumbnailFileId)
	await cancelQueuedClosure(acquisitionId)
	pumpUploads()
}

// CAP-018-R11, CAP-015-R33
export async function reorderCapturedPhotos(owner: PhotoOwner, fileKeys: readonly string[]): Promise<void> {
	await keepUnlessForgotten(
		async () => {
			const buffer = await transferBuffer()
			await buffer.reorder(owner.acquisitionId, fileKeys)
			return await buffer.photos(owner.acquisitionId, owner.operatorUserId)
		},
		(photos) => showCapturedPhotos(owner.acquisitionId, photos),
	)
}

// CAP-002-R21
export async function thumbnailOf(photo: BufferedFile): Promise<Uint8Array> {
	const buffer = await transferBuffer()
	return buffer.thumbnail(photo)
}

// CAP-015-R34, CAP-019-R29
async function editCapturedPhoto(
	acquisitionId: string,
	photo: BufferedFile,
	edit: PhotoEdit,
	kind: FileEdit,
): Promise<void> {
	await keepUnlessForgotten(
		async () => {
			const buffer = await transferBuffer()
			const content = await buffer.content(photo)
			return await buffer.replacePhoto(photo.fileKey, await edit(content.path, content.wrappedKey), kind)
		},
		(edited) => replaceCapturedPhoto(acquisitionId, edited),
	)
	forgetThumbnail(photo.thumbnailFileId)
	await cancelQueuedClosure(acquisitionId)
	pumpUploads()
}
