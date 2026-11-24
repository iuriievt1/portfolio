import { useEffect } from "react"
import { findingApi } from "../../../api/findings"
import { imageApi } from "../../../api/images"
import { readAllPages } from "../../../api/pages"
import { jpegDataUriOf } from "../../../utils/base64"
import { useSharedValue } from "../../../utils/shared-value"
import { useThumbnailUri } from "../../../utils/thumbnail-cache"
import { sessionCaller } from "../../session/session-actions"
import { type EarlierPhoto, earlierPhotosOf, keepEarlierPhotos, loadedEarlierPhotos } from "../earlier-photos"

const NO_PHOTOS: readonly EarlierPhoto[] = []

// CAP-016-R17, CAP-015-R32
export function useEarlierPhotos(findingId: string | undefined): readonly EarlierPhoto[] {
	useEffect(() => {
		if (findingId === undefined) {
			return
		}
		keepEarlierPhotos(findingId, async () => {
			const items = await readAllPages((cursor) =>
				sessionCaller.call((sessionToken) => findingApi.getFindingHistory(sessionToken, findingId, cursor)),
			)
			return earlierPhotosOf(items)
		}).catch((failure: unknown) => console.warn("the earlier photos of the wound could not be read", failure))
	}, [findingId])
	return useLoadedEarlierPhotos(findingId)
}

// CAP-015-R32
export function useLoadedEarlierPhotos(findingId: string | undefined): readonly EarlierPhoto[] {
	const loaded = useSharedValue(loadedEarlierPhotos)
	return findingId === undefined ? NO_PHOTOS : (loaded.get(findingId) ?? NO_PHOTOS)
}

// ADR-026, CAP-009-R11
export function useEarlierThumbnail(imageId: string): string | undefined {
	return useThumbnailUri(imageId, async () =>
		jpegDataUriOf(await sessionCaller.call((sessionToken) => imageApi.getImageThumbnail(sessionToken, imageId))),
	)
}
