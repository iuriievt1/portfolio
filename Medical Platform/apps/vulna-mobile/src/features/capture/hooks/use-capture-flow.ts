import { useNavigation, useRouter } from "expo-router"
import { useMemo } from "react"
import { ROUTE } from "../../../navigation/routes"
import { CAPTURE_STEP, type CaptureStep } from "../../assessment/clinical-steps"
import { REVIEW_OPENER, type ReviewOpening } from "../../summary/review-opening"

export const CAPTURE_ORIGIN = {
	SUMMARY: "summary",
} as const

export type CaptureOrigin = (typeof CAPTURE_ORIGIN)[keyof typeof CAPTURE_ORIGIN]

interface CaptureFlow {
	close: () => void
	back: () => void
	review: (fileKey: string, opening: ReviewOpening<CaptureOrigin>) => void
	location: (origin?: CaptureOrigin) => void
	next: (step: CaptureStep, origin: CaptureOrigin | undefined) => void
	note: () => void
	addPhoto: () => void
	retakeFromSummary: (replacedKey: string | undefined) => void
	retakeFromReview: (replacedKey: string | undefined, opening: ReviewOpening<CaptureOrigin>) => void
	crop: (fileKey: string) => void
	earlierPhoto: (findingId: string, imageId: string) => void
}

// CAP-015-R31, CAP-015-R36, CAP-009-S05, Q-076
export function useCaptureFlow(visitId: string, acquisitionId: string): CaptureFlow {
	const router = useRouter()
	const navigation = useNavigation()
	return useMemo(() => {
		const params = { id: visitId, acquisitionId }
		// CAP-015-R31, CAP-017-R16
		const next = (step: CaptureStep, origin: CaptureOrigin | undefined) => {
			switch (step) {
				case CAPTURE_STEP.WOUND_TYPE:
					router.push({ pathname: ROUTE.CAPTURE_WOUND_TYPE, params: { ...params, origin } })
					return
				case CAPTURE_STEP.HEALING_PHASE:
					router.push({ pathname: ROUTE.CAPTURE_HEALING_PHASE, params: { ...params, origin } })
					return
				case CAPTURE_STEP.SUMMARY:
					if (origin === CAPTURE_ORIGIN.SUMMARY) {
						router.dismissTo({ pathname: ROUTE.CAPTURE_SUMMARY, params })
						return
					}
					router.push({ pathname: ROUTE.CAPTURE_SUMMARY, params })
					return
				default:
					return step satisfies never
			}
		}
		return {
			close: () => navigation.getParent()?.goBack(),
			back: () => router.back(),
			review: (fileKey, opening) =>
				router.push({ pathname: ROUTE.CAPTURE_REVIEW, params: { ...params, fileKey, ...opening } }),
			location: (origin) => router.push({ pathname: ROUTE.CAPTURE_LOCATION, params: { ...params, origin } }),
			next,
			note: () => router.push({ pathname: ROUTE.CAPTURE_NOTE, params }),
			crop: (fileKey) => router.push({ pathname: ROUTE.CAPTURE_CROP, params: { ...params, fileKey } }),
			earlierPhoto: (findingId, imageId) =>
				router.push({ pathname: ROUTE.CAPTURE_EARLIER_PHOTO, params: { ...params, findingId, imageId } }),
			addPhoto: () => router.push({ pathname: ROUTE.CAPTURE, params: { ...params, origin: CAPTURE_ORIGIN.SUMMARY } }),
			retakeFromSummary: (replacedKey) =>
				router.push({
					pathname: ROUTE.CAPTURE,
					params: { ...params, origin: CAPTURE_ORIGIN.SUMMARY, replaces: replacedKey },
				}),
			retakeFromReview: (replacedKey, opening) => {
				if (opening.opener === REVIEW_OPENER.SUMMARY) {
					router.replace({
						pathname: ROUTE.CAPTURE,
						params: { ...params, origin: CAPTURE_ORIGIN.SUMMARY, replaces: replacedKey },
					})
					return
				}
				router.dismissTo({
					pathname: ROUTE.CAPTURE,
					params: { ...params, origin: opening.cameraOrigin, replaces: replacedKey },
				})
			},
		}
	}, [router, navigation, visitId, acquisitionId])
}
