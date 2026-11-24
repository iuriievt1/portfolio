import type { BufferedFile } from "@ansora/core-mobile"
import { afterEach, describe, expect, it } from "vitest"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import type { Finding } from "../../../api/findings"
import {
	addCapturedPhoto,
	captureSessionOf,
	chooseWound,
	clearWound,
	dropShot,
	forgetCaptureSessions,
	keepUnlessForgotten,
	rememberDraft,
	removeCapturedPhoto,
	replaceCapturedPhoto,
	showCapturedPhotos,
	showShotPreview,
	startShot,
	WOUND_CHOICE,
} from "../capture-session"

const ACQUISITION = "0b6c1d52-6f0e-4a8e-9a43-0d6a0f1f6d10"
const OTHER_ACQUISITION = "5f3a9e1c-2b7d-4c55-8e0a-7d1b2c3e4f50"
const OPERATOR = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"

function photo(fileKey: string, position: number): BufferedFile {
	return {
		fileKey,
		acquisitionId: ACQUISITION,
		operatorUserId: OPERATOR,
		position,
		contentFileId: `/vault/queue/${fileKey}`,
		thumbnailFileId: `/vault/queue/${fileKey}-thumbnail`,
		width: 3024,
		height: 4032,
		capturedAt: "2026-10-08T09:00:00.000Z",
		kind: "image",
		originalFileId: null,
		corners: null,
		uploadState: "waiting",
		sentContentFileId: null,
		receivedContentFileId: null,
		contentEdit: null,
		rejectionCode: null,
		editFailedContentFileId: null,
		replacesFileKey: null,
	}
}

const FIRST = photo("first", 1)
const SECOND = photo("second", 2)
const BODY_SITE = {
	region_code: "51027004",
	laterality: null,
	view: "posterior",
	x: 0.5,
	y: 0.52,
	body_diagram_version: "1",
} as const
const FINDING: Finding = {
	finding_id: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
	patient_id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
	number: 1,
	created_at: "2026-09-30T08:00:00Z",
	last_body_site: BODY_SITE,
	wound_type_code: "pressure-injury",
}

const PREVIEW = "data:image/jpeg;base64,/9j/"
const DRAFT = { acquisition_id: ACQUISITION, version: 2, finding_id: null } as AcquisitionDraft

function deferred<T>() {
	let resolve: (value: T) => void = () => {}
	const promise = new Promise<T>((settle) => {
		resolve = settle
	})
	return { promise, resolve }
}

afterEach(() => {
	forgetCaptureSessions()
})

describe("capture session", () => {
	it("CAP-015-R33 keeps the series in the order of capture", () => {
		addCapturedPhoto(ACQUISITION, FIRST)
		addCapturedPhoto(ACQUISITION, SECOND)

		expect(captureSessionOf(ACQUISITION).photos).toEqual([FIRST, SECOND])
		expect(captureSessionOf(OTHER_ACQUISITION).photos).toEqual([])
	})

	it("CAP-015-R36 CAP-019-S12 puts the new photo in place of the rejected one it replaces", () => {
		const rejected = { ...photo("rejected", 2), uploadState: "rejected" as const }
		showCapturedPhotos(ACQUISITION, [FIRST, rejected, photo("third", 3)])

		addCapturedPhoto(ACQUISITION, { ...photo("new", 2), replacesFileKey: "rejected" })

		expect(captureSessionOf(ACQUISITION).photos.map((kept) => kept.fileKey)).toEqual(["first", "new", "third"])
	})

	it("CAP-015-R36 adds a new photo of a file only the server had at the end of the series", () => {
		showCapturedPhotos(ACQUISITION, [FIRST, SECOND])

		addCapturedPhoto(ACQUISITION, { ...photo("new", 3), replacesFileKey: "on-server" })

		expect(captureSessionOf(ACQUISITION).photos.map((kept) => kept.fileKey)).toEqual(["first", "second", "new"])
	})

	it("CAP-015-S04 shows the series kept in the transfer buffer", () => {
		showCapturedPhotos(ACQUISITION, [FIRST, SECOND])

		expect(captureSessionOf(ACQUISITION).photos).toEqual([FIRST, SECOND])
		expect(captureSessionOf(ACQUISITION).isSeriesLoaded).toBe(true)
		expect(captureSessionOf(OTHER_ACQUISITION).isSeriesLoaded).toBe(false)
	})

	it("CAP-015-R34 puts the edited photo in its place in the series", () => {
		showCapturedPhotos(ACQUISITION, [FIRST, SECOND])
		const turned = { ...FIRST, contentFileId: "/vault/queue/turned", width: 4032, height: 3024 }

		replaceCapturedPhoto(ACQUISITION, turned)

		expect(captureSessionOf(ACQUISITION).photos).toEqual([turned, SECOND])
	})

	it("CAP-015-S12 removes a photo from the series", () => {
		showCapturedPhotos(ACQUISITION, [FIRST, SECOND])

		removeCapturedPhoto(ACQUISITION, FIRST.fileKey)

		expect(captureSessionOf(ACQUISITION).photos).toEqual([SECOND])
	})

	it("CAP-015-R10 shows a shot at once and swaps it for the kept photo", () => {
		showCapturedPhotos(ACQUISITION, [FIRST])
		startShot(ACQUISITION, SECOND.fileKey)
		showShotPreview(ACQUISITION, SECOND.fileKey, PREVIEW)

		expect(captureSessionOf(ACQUISITION).shots).toEqual([SECOND.fileKey])

		addCapturedPhoto(ACQUISITION, SECOND)

		expect(captureSessionOf(ACQUISITION).photos).toEqual([FIRST, SECOND])
		expect(captureSessionOf(ACQUISITION).shots).toEqual([])
		expect(captureSessionOf(ACQUISITION).previews.get(SECOND.fileKey)).toBe(PREVIEW)
	})

	it("CAP-015-R33 does not repeat a kept photo the buffer already showed", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		showCapturedPhotos(ACQUISITION, [FIRST])

		addCapturedPhoto(ACQUISITION, FIRST)

		expect(captureSessionOf(ACQUISITION).photos).toEqual([FIRST])
		expect(captureSessionOf(ACQUISITION).shots).toEqual([])
	})

	it("CAP-015-R34 drops the preview once the photo is edited", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		showShotPreview(ACQUISITION, FIRST.fileKey, PREVIEW)
		addCapturedPhoto(ACQUISITION, FIRST)

		replaceCapturedPhoto(ACQUISITION, { ...FIRST, uploadState: "uploading" })

		expect(captureSessionOf(ACQUISITION).previews.get(FIRST.fileKey)).toBe(PREVIEW)

		replaceCapturedPhoto(ACQUISITION, { ...FIRST, thumbnailFileId: "/vault/queue/turned-thumbnail" })

		expect(captureSessionOf(ACQUISITION).previews.has(FIRST.fileKey)).toBe(false)
	})

	it("E18 removes a shot that could not be kept", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		showShotPreview(ACQUISITION, FIRST.fileKey, PREVIEW)

		dropShot(ACQUISITION, FIRST.fileKey)

		expect(captureSessionOf(ACQUISITION).shots).toEqual([])
		expect(captureSessionOf(ACQUISITION).previews.size).toBe(0)
	})

	it("CAP-015-R10 keeps several shots in the order of the shutter", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		startShot(ACQUISITION, SECOND.fileKey)

		expect(captureSessionOf(ACQUISITION).shots).toEqual([FIRST.fileKey, SECOND.fileKey])

		addCapturedPhoto(ACQUISITION, FIRST)

		expect(captureSessionOf(ACQUISITION).shots).toEqual([SECOND.fileKey])
		expect(captureSessionOf(OTHER_ACQUISITION).shots).toEqual([])
	})

	it("CAP-015-S04 swaps the shots the transfer buffer already holds", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		startShot(ACQUISITION, SECOND.fileKey)

		showCapturedPhotos(ACQUISITION, [FIRST])

		expect(captureSessionOf(ACQUISITION).shots).toEqual([SECOND.fileKey])
	})

	it("E18 shows no preview that arrives after the shot was dropped", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		dropShot(ACQUISITION, FIRST.fileKey)

		showShotPreview(ACQUISITION, FIRST.fileKey, PREVIEW)

		expect(captureSessionOf(ACQUISITION).previews.size).toBe(0)
	})

	it("E18 keeps the other shots when one could not be kept", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		startShot(ACQUISITION, SECOND.fileKey)
		showShotPreview(ACQUISITION, SECOND.fileKey, PREVIEW)

		dropShot(ACQUISITION, FIRST.fileKey)

		expect(captureSessionOf(ACQUISITION).shots).toEqual([SECOND.fileKey])
		expect(captureSessionOf(ACQUISITION).previews.get(SECOND.fileKey)).toBe(PREVIEW)
	})

	it("CAP-015-R18 forgets the preview of a removed photo", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		showShotPreview(ACQUISITION, FIRST.fileKey, PREVIEW)
		addCapturedPhoto(ACQUISITION, FIRST)

		removeCapturedPhoto(ACQUISITION, FIRST.fileKey)

		expect(captureSessionOf(ACQUISITION).previews.has(FIRST.fileKey)).toBe(false)
	})

	it("CAP-013-R08 shows no preview of a shot from forgotten sessions", () => {
		startShot(ACQUISITION, FIRST.fileKey)
		forgetCaptureSessions()

		showShotPreview(ACQUISITION, FIRST.fileKey, PREVIEW)

		expect(captureSessionOf(ACQUISITION).previews.size).toBe(0)
	})

	it("CAP-015-R31 keeps the wound chosen last on the body diagram", () => {
		chooseWound(ACQUISITION, { kind: WOUND_CHOICE.NEW, bodySite: BODY_SITE, findingKey: undefined })

		chooseWound(ACQUISITION, { kind: WOUND_CHOICE.EXISTING, finding: FINDING, bodySite: BODY_SITE })

		expect(captureSessionOf(ACQUISITION).wound).toEqual({
			kind: WOUND_CHOICE.EXISTING,
			finding: FINDING,
			bodySite: BODY_SITE,
		})
	})

	it("CAP-016-R14 keeps the place cleared on the body diagram until a wound is chosen again", () => {
		chooseWound(ACQUISITION, { kind: WOUND_CHOICE.EXISTING, finding: FINDING, bodySite: BODY_SITE })

		clearWound(ACQUISITION)

		expect(captureSessionOf(ACQUISITION)).toMatchObject({ wound: undefined, isWoundCleared: true })

		chooseWound(ACQUISITION, { kind: WOUND_CHOICE.NEW, bodySite: BODY_SITE, findingKey: undefined })

		expect(captureSessionOf(ACQUISITION).isWoundCleared).toBe(false)
	})

	it("CAP-021-R32 keeps the draft the server answered last", () => {
		rememberDraft(DRAFT)

		expect(captureSessionOf(ACQUISITION).draft).toBe(DRAFT)
	})

	it("CAP-013-R08 forgets the series, the draft and the wound", () => {
		showCapturedPhotos(ACQUISITION, [FIRST])
		rememberDraft(DRAFT)
		chooseWound(ACQUISITION, { kind: WOUND_CHOICE.EXISTING, finding: FINDING, bodySite: BODY_SITE })

		forgetCaptureSessions()

		expect(captureSessionOf(ACQUISITION)).toEqual({
			photos: [],
			shots: [],
			previews: new Map(),
			isSeriesLoaded: false,
			draft: undefined,
			wound: undefined,
			isWoundCleared: false,
		})
	})

	it("CAP-013-R08 drops a photo kept after the sessions were forgotten", async () => {
		const keptPhoto = deferred<BufferedFile>()
		const keeping = keepUnlessForgotten(
			() => keptPhoto.promise,
			(kept) => addCapturedPhoto(ACQUISITION, kept),
		)

		forgetCaptureSessions()
		keptPhoto.resolve(FIRST)
		await keeping

		expect(captureSessionOf(ACQUISITION).photos).toEqual([])
	})

	it("CAP-013-R08 drops a draft answered after the sessions were forgotten", async () => {
		const answered = deferred<AcquisitionDraft>()
		const updating = keepUnlessForgotten(() => answered.promise, rememberDraft)

		forgetCaptureSessions()
		answered.resolve(DRAFT)

		expect(await updating).toBe(DRAFT)
		expect(captureSessionOf(ACQUISITION).draft).toBeUndefined()
	})

	it("keeps what finished while the sessions were remembered", async () => {
		await keepUnlessForgotten(async () => DRAFT, rememberDraft)

		expect(captureSessionOf(ACQUISITION).draft).toBe(DRAFT)
	})
})
