// CAP-015-R32, CAP-015-R36, CAP-019-S12
export const REVIEW_OPENER = {
	CAMERA: "camera",
	SUMMARY: "summary",
} as const

export type ReviewOpener = (typeof REVIEW_OPENER)[keyof typeof REVIEW_OPENER]

export interface ReviewOpening<Origin extends string> {
	opener: ReviewOpener
	cameraOrigin: Origin | undefined
}

export function reviewOpeningOf<Origin extends string>(
	opener: string | undefined,
	cameraOrigin: Origin | undefined,
): ReviewOpening<Origin> {
	return { opener: opener === REVIEW_OPENER.SUMMARY ? REVIEW_OPENER.SUMMARY : REVIEW_OPENER.CAMERA, cameraOrigin }
}
