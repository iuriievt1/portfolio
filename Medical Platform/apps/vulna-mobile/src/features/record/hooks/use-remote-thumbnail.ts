import { useEffect, useRef, useState } from "react"
import { imageApi } from "../../../api/images"
import { jpegDataUriOf } from "../../../utils/base64"
import { shownThumbnail } from "../../../utils/thumbnail-cache"
import { sessionCaller } from "../../session/session-actions"
import { THUMBNAIL, type ThumbnailState, thumbnailFailureOf } from "../image-state"

const LOADING: ThumbnailState = { kind: THUMBNAIL.LOADING }
const MISSING: ThumbnailState = { kind: THUMBNAIL.MISSING }

// ADR-026, CAP-020-R10, CAP-020-R22
export function useRemoteThumbnail(key: string | undefined, read: () => Promise<Uint8Array>): ThumbnailState {
	const [state, setState] = useState<ThumbnailState>(LOADING)
	const reader = useRef(read)
	reader.current = read
	useEffect(() => {
		if (key === undefined) {
			setState(MISSING)
			return
		}
		let isCurrent = true
		setState(LOADING)
		shownThumbnail(key, async () => jpegDataUriOf(await reader.current()))
			.then((uri) => {
				if (isCurrent) {
					setState({ kind: THUMBNAIL.SHOWN, uri })
				}
			})
			.catch((failure: unknown) => {
				if (isCurrent) {
					setState(thumbnailFailureOf(failure))
				}
			})
		return () => {
			isCurrent = false
		}
	}, [key])
	return state
}

// ADR-026
export function useImageThumbnail(imageId: string | undefined): ThumbnailState {
	return useRemoteThumbnail(imageId, () =>
		sessionCaller.call((sessionToken) => imageApi.getImageThumbnail(sessionToken, imageId ?? "")),
	)
}

// ADR-026, CAP-020-R17
export function usePageThumbnail(pageId: string | undefined): ThumbnailState {
	return useRemoteThumbnail(pageId, () =>
		sessionCaller.call((sessionToken) => imageApi.getDocumentPageThumbnail(sessionToken, pageId ?? "")),
	)
}
