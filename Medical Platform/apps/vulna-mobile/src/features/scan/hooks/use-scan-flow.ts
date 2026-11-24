import { useNavigation, useRouter } from "expo-router"
import { useMemo } from "react"
import { ROUTE } from "../../../navigation/routes"
import { REVIEW_OPENER, type ReviewOpening } from "../../summary/review-opening"

export const SCAN_ORIGIN = {
	SUMMARY: "summary",
} as const

export type ScanOrigin = (typeof SCAN_ORIGIN)[keyof typeof SCAN_ORIGIN]

interface ScanFlow {
	close: () => void
	back: () => void
	title: (origin?: ScanOrigin) => void
	customTitle: (origin?: ScanOrigin) => void
	afterTitle: (origin?: ScanOrigin) => void
	summary: () => void
	page: (fileKey: string, opening: ReviewOpening<ScanOrigin>) => void
	crop: (fileKey: string) => void
	addPage: () => void
	retakeFromSummary: (replacedKey: string | undefined) => void
	retakeFromReview: (replacedKey: string | undefined, opening: ReviewOpening<ScanOrigin>) => void
}

// CAP-018-R02, CAP-018-R15, CAP-018-R11, CAP-014-R23, CAP-015-R36, CAP-009-S05, Q-076
export function useScanFlow(visitId: string, acquisitionId: string): ScanFlow {
	const router = useRouter()
	const navigation = useNavigation()
	return useMemo(() => {
		const params = { id: visitId, acquisitionId }
		const summary = () => router.push({ pathname: ROUTE.SCAN_SUMMARY, params })
		return {
			close: () => navigation.getParent()?.goBack(),
			back: () => router.back(),
			title: (origin) => router.push({ pathname: ROUTE.SCAN_TITLE, params: { ...params, origin } }),
			customTitle: (origin) => router.push({ pathname: ROUTE.SCAN_CUSTOM_TITLE, params: { ...params, origin } }),
			afterTitle: (origin) => {
				if (origin === SCAN_ORIGIN.SUMMARY) {
					router.dismissTo({ pathname: ROUTE.SCAN_SUMMARY, params })
					return
				}
				summary()
			},
			summary,
			page: (fileKey, opening) =>
				router.push({ pathname: ROUTE.SCAN_PAGE, params: { ...params, fileKey, ...opening } }),
			crop: (fileKey) => router.push({ pathname: ROUTE.SCAN_CROP, params: { ...params, fileKey } }),
			addPage: () => router.push({ pathname: ROUTE.SCAN, params: { ...params, origin: SCAN_ORIGIN.SUMMARY } }),
			retakeFromSummary: (replacedKey) =>
				router.push({
					pathname: ROUTE.SCAN,
					params: { ...params, origin: SCAN_ORIGIN.SUMMARY, replaces: replacedKey },
				}),
			retakeFromReview: (replacedKey, opening) => {
				if (opening.opener === REVIEW_OPENER.SUMMARY) {
					router.replace({
						pathname: ROUTE.SCAN,
						params: { ...params, origin: SCAN_ORIGIN.SUMMARY, replaces: replacedKey },
					})
					return
				}
				router.dismissTo({
					pathname: ROUTE.SCAN,
					params: { ...params, origin: opening.cameraOrigin, replaces: replacedKey },
				})
			},
		}
	}, [router, navigation, visitId, acquisitionId])
}
