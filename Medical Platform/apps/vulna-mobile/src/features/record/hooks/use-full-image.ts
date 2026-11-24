import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useEffect, useMemo, useState } from "react"
import { type DownloadedImage, IMAGE_RENDITION, imageApi } from "../../../api/images"
import type { AcquisitionDetailFile } from "../../../api/record"
import { jpegDataUriOf } from "../../../utils/base64"
import { sessionCaller } from "../../session/session-actions"
import { FULL_IMAGE, type FullImageState, fullImageFailureOf } from "../image-state"

const LOADING: FullImageState = { kind: FULL_IMAGE.LOADING }
const MISSING: FullImageState = { kind: FULL_IMAGE.MISSING }

type ImageRead = (sessionToken: string) => Promise<DownloadedImage>

// CAP-020-R09, CAP-020-R15, CAP-020-R22, CAP-021-R40, E124, E125
export function useFullImage(file: AcquisitionDetailFile | undefined) {
	const [state, setState] = useState<FullImageState>(LOADING)
	const [attempt, setAttempt] = useState(0)
	const imageId = file?.image_id ?? undefined
	const pageId = file?.page_id ?? undefined
	const request = useMemo(() => ({ read: fullImageReadOf(imageId, pageId), attempt }), [imageId, pageId, attempt])

	useEffect(() => {
		const { read } = request
		if (read === undefined) {
			setState(MISSING)
			return
		}
		let isCurrent = true
		setState(LOADING)
		sessionCaller
			.call(read)
			.then((image) => {
				if (isCurrent) {
					setState(shownStateOf(image))
				}
			})
			.catch((failure: unknown) => {
				if (isCurrent && !(failure instanceof NoSessionError)) {
					setState(fullImageFailureOf(failure))
				}
			})
		return () => {
			isCurrent = false
		}
	}, [request])

	const retry = useCallback(() => setAttempt((count) => count + 1), [])
	return { state, retry }
}

// CAP-020-R15
function fullImageReadOf(imageId: string | undefined, pageId: string | undefined): ImageRead | undefined {
	if (imageId !== undefined) {
		return (sessionToken) => imageApi.getImage(sessionToken, imageId)
	}
	if (pageId !== undefined) {
		return (sessionToken) => imageApi.getDocumentPage(sessionToken, pageId)
	}
	return undefined
}

// CAP-021-R40
function shownStateOf(image: DownloadedImage): FullImageState {
	return {
		kind: FULL_IMAGE.SHOWN,
		uri: jpegDataUriOf(image.bytes),
		isViewingCopy: image.rendition === IMAGE_RENDITION.VIEWING_COPY,
	}
}
