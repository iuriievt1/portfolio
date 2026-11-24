import type { BufferedFile } from "@ansora/core-mobile"
import type { AcquisitionDraft } from "../../api/acquisitions"
import type { BodySite, Finding } from "../../api/findings"
import { sharedValue, useSharedValue } from "../../utils/shared-value"

export const WOUND_CHOICE = {
	NEW: "new",
	EXISTING: "existing",
} as const

// CAP-016-R17, CAP-020-R13
export type WoundChoice =
	| { kind: typeof WOUND_CHOICE.NEW; bodySite: BodySite; findingKey: string | undefined }
	| { kind: typeof WOUND_CHOICE.EXISTING; finding: Finding; bodySite: BodySite }

export interface CaptureSession {
	photos: readonly BufferedFile[]
	shots: readonly string[]
	previews: ReadonlyMap<string, string>
	isSeriesLoaded: boolean
	draft: AcquisitionDraft | undefined
	wound: WoundChoice | undefined
	isWoundCleared: boolean
}

export const NO_SHOTS: readonly string[] = []
export const NO_PREVIEWS: ReadonlyMap<string, string> = new Map()

const EMPTY_SESSION: CaptureSession = {
	photos: [],
	shots: NO_SHOTS,
	previews: NO_PREVIEWS,
	isSeriesLoaded: false,
	draft: undefined,
	wound: undefined,
	isWoundCleared: false,
}

const sessions = sharedValue<ReadonlyMap<string, CaptureSession>>(new Map())
let forgottenCount = 0

export function captureSessionOf(acquisitionId: string): CaptureSession {
	return sessions.get().get(acquisitionId) ?? EMPTY_SESSION
}

export function useCaptureSession(acquisitionId: string): CaptureSession {
	return useSharedValue(sessions).get(acquisitionId) ?? EMPTY_SESSION
}

// CAP-015-S04
export function showCapturedPhotos(acquisitionId: string, photos: readonly BufferedFile[]): void {
	change(acquisitionId, (session) => ({
		...session,
		photos,
		shots: session.shots.filter((shot) => !photos.some((photo) => photo.fileKey === shot)),
		isSeriesLoaded: true,
	}))
}

// CAP-015-R10, CAP-018-R02
export function startShot(acquisitionId: string, fileKey: string): void {
	change(acquisitionId, (session) => ({ ...session, shots: [...session.shots, fileKey] }))
}

// CAP-015-R10, CAP-009-R11
export function showShotPreview(acquisitionId: string, fileKey: string, previewUri: string): void {
	change(acquisitionId, (session) =>
		isInSeries(session, fileKey)
			? { ...session, previews: new Map(session.previews).set(fileKey, previewUri) }
			: session,
	)
}

// E17, E18
export function dropShot(acquisitionId: string, fileKey: string): void {
	change(acquisitionId, (session) => ({
		...session,
		shots: session.shots.filter((shot) => shot !== fileKey),
		previews: withoutPreview(session.previews, fileKey),
	}))
}

// CAP-015-R33, CAP-015-R36, CAP-019-S12
export function addCapturedPhoto(acquisitionId: string, photo: BufferedFile): void {
	change(acquisitionId, (session) => ({
		...session,
		photos: withPhoto(session.photos, photo),
		shots: session.shots.filter((shot) => shot !== photo.fileKey),
	}))
}

// CAP-015-R34
export function replaceCapturedPhoto(acquisitionId: string, photo: BufferedFile): void {
	change(acquisitionId, (session) => ({
		...session,
		photos: session.photos.map((current) => (current.fileKey === photo.fileKey ? photo : current)),
		previews: isSameImage(session, photo) ? session.previews : withoutPreview(session.previews, photo.fileKey),
	}))
}

// CAP-015-R18
export function removeCapturedPhoto(acquisitionId: string, fileKey: string): void {
	change(acquisitionId, (session) => ({
		...session,
		photos: session.photos.filter((photo) => photo.fileKey !== fileKey),
		previews: withoutPreview(session.previews, fileKey),
	}))
}

// CAP-015-R15, CAP-021-R32
export function rememberDraft(draft: AcquisitionDraft): void {
	change(draft.acquisition_id, (session) => ({ ...session, draft }))
}

// CAP-015-R31
export function chooseWound(acquisitionId: string, wound: WoundChoice): void {
	change(acquisitionId, (session) => ({ ...session, wound, isWoundCleared: false }))
}

// CAP-016-R14
export function clearWound(acquisitionId: string): void {
	change(acquisitionId, (session) => ({ ...session, wound: undefined, isWoundCleared: true }))
}

// CAP-013-R08
export async function keepUnlessForgotten<T>(work: () => Promise<T>, keep: (result: T) => void): Promise<T> {
	const startedSince = forgottenCount
	const result = await work()
	if (startedSince === forgottenCount) {
		keep(result)
	}
	return result
}

// CAP-013-R08
export function forgetCaptureSessions(): void {
	forgottenCount += 1
	sessions.set(new Map())
}

// CAP-015-R36, CAP-019-S12
function withPhoto(photos: readonly BufferedFile[], photo: BufferedFile): BufferedFile[] {
	const others = photos.filter((current) => current.fileKey !== photo.fileKey)
	const isReplacing = others.some((current) => current.fileKey === photo.replacesFileKey)
	if (!isReplacing) {
		return [...others, photo]
	}
	return others.map((current) => (current.fileKey === photo.replacesFileKey ? photo : current))
}

function isInSeries(session: CaptureSession, fileKey: string): boolean {
	return session.shots.includes(fileKey) || session.photos.some((photo) => photo.fileKey === fileKey)
}

function isSameImage(session: CaptureSession, photo: BufferedFile): boolean {
	const current = session.photos.find((candidate) => candidate.fileKey === photo.fileKey)
	return current?.thumbnailFileId === photo.thumbnailFileId
}

function withoutPreview(previews: ReadonlyMap<string, string>, fileKey: string): ReadonlyMap<string, string> {
	if (!previews.has(fileKey)) {
		return previews
	}
	const remaining = new Map(previews)
	remaining.delete(fileKey)
	return remaining
}

function change(acquisitionId: string, update: (session: CaptureSession) => CaptureSession): void {
	const next = new Map(sessions.get())
	next.set(acquisitionId, update(captureSessionOf(acquisitionId)))
	sessions.set(next)
}
