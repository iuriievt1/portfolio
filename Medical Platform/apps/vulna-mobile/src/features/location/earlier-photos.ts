import { ACQUISITION_KIND } from "@ansora/contracts"
import type { BodySite, TimelineItem } from "../../api/findings"
import { sharedValue } from "../../utils/shared-value"

export interface EarlierPhoto {
	imageId: string
	takenAt: string
	bodySite: BodySite | undefined
}

export const loadedEarlierPhotos = sharedValue<ReadonlyMap<string, readonly EarlierPhoto[]>>(new Map())
let forgottenCount = 0

// CAP-016-R17, CAP-015-R32, CAP-020-R10, E106
export function earlierPhotosOf(items: readonly TimelineItem[]): readonly EarlierPhoto[] {
	return items
		.filter((item) => item.kind === ACQUISITION_KIND.PHOTO && hasThumbnail(item))
		.flatMap((item) =>
			(item.images ?? []).map((image) => ({ imageId: image.image_id, takenAt: item.time, bodySite: item.body_site })),
		)
}

// CAP-013-R08, CAP-020-R12
export async function keepEarlierPhotos(
	findingId: string,
	read: () => Promise<readonly EarlierPhoto[]>,
): Promise<void> {
	const readSince = forgottenCount
	try {
		const photos = await read()
		if (readSince === forgottenCount) {
			changePhotos((next) => next.set(findingId, photos))
		}
	} catch (failure) {
		if (readSince === forgottenCount) {
			changePhotos((next) => next.delete(findingId))
		}
		throw failure
	}
}

// CAP-020-R02, CAP-013-R08
export function forgetEarlierPhotos(): void {
	forgottenCount += 1
	loadedEarlierPhotos.set(new Map())
}

function hasThumbnail(item: TimelineItem): boolean {
	return item.thumbnail_url !== null && item.thumbnail_url !== undefined
}

function changePhotos(change: (next: Map<string, readonly EarlierPhoto[]>) => void): void {
	const next = new Map(loadedEarlierPhotos.get())
	change(next)
	loadedEarlierPhotos.set(next)
}
