import { afterEach, describe, expect, it } from "vitest"
import type { TimelineItem } from "../../../api/findings"
import {
	type EarlierPhoto,
	earlierPhotosOf,
	forgetEarlierPhotos,
	keepEarlierPhotos,
	loadedEarlierPhotos,
} from "../earlier-photos"

const FINDING_ID = "finding-1"
const PHOTO: EarlierPhoto = { imageId: "image-1", takenAt: "2026-10-01T09:00:00Z", bodySite: undefined }

function deferred<T>() {
	let resolve: (value: T) => void = () => {}
	const promise = new Promise<T>((settle) => {
		resolve = settle
	})
	return { promise, resolve }
}

function timelineItem(change: Partial<TimelineItem>): TimelineItem {
	return {
		acquisition_id: "a0000000-0000-4000-8000-000000000001",
		time: "2026-10-01T09:00:00Z",
		kind: "photo",
		is_image_data_available: true,
		thumbnail_url: "/images/image-1/thumbnail",
		images: [{ image_id: "image-1" }],
		...change,
	}
}

afterEach(() => forgetEarlierPhotos())

describe("earlier photos of a wound", () => {
	it("CAP-016-S14 lists every photo of the earlier records that still have a thumbnail", () => {
		const items = [
			timelineItem({ images: [{ image_id: "image-1" }, { image_id: "image-2" }] }),
			timelineItem({ is_image_data_available: false, images: [{ image_id: "image-3" }] }),
			timelineItem({ thumbnail_url: null, images: [{ image_id: "image-4" }] }),
			timelineItem({ kind: "scan", images: [{ image_id: "image-5" }] }),
		]

		expect(earlierPhotosOf(items).map((photo) => photo.imageId)).toEqual(["image-1", "image-2", "image-3"])
	})

	it("keeps the photos of a finding once read", async () => {
		await keepEarlierPhotos(FINDING_ID, async () => [PHOTO])
		expect(loadedEarlierPhotos.get().get(FINDING_ID)).toEqual([PHOTO])
	})

	it("CAP-020-R12 drops the photos read earlier once a new read fails", async () => {
		await keepEarlierPhotos(FINDING_ID, async () => [PHOTO])

		const failing = keepEarlierPhotos(FINDING_ID, async () => {
			throw new Error("offline")
		})

		await expect(failing).rejects.toThrow("offline")
		expect(loadedEarlierPhotos.get().has(FINDING_ID)).toBe(false)
	})

	it("CAP-013-R08 drops a read that finishes after the patient context was forgotten", async () => {
		const read = deferred<readonly EarlierPhoto[]>()
		const keeping = keepEarlierPhotos(FINDING_ID, () => read.promise)
		forgetEarlierPhotos()
		read.resolve([PHOTO])
		await keeping
		expect(loadedEarlierPhotos.get().has(FINDING_ID)).toBe(false)
	})
})
