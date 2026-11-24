import type { BufferedFile } from "@ansora/core-mobile"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { usePhotoEdits } from "../../../../../features/capture/hooks/use-photo-edits"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import { PageReviewScreen } from "../../../../../features/scan/components/PageReviewScreen"
import { usePageCrop } from "../../../../../features/scan/hooks/use-page-crop"
import { type ScanOrigin, useScanFlow } from "../../../../../features/scan/hooks/use-scan-flow"
import { retakeInPlace, retakeOfFile } from "../../../../../features/summary/retake"
import { type ReviewOpening, reviewOpeningOf } from "../../../../../features/summary/review-opening"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	fileKey: string
	opening: ReviewOpening<ScanOrigin>
	patient: Patient
}

// CAP-018-R11, CAP-015-R36, Figma 06 B.2, B.4, E.2
export default function PageRoute() {
	const { id, acquisitionId, fileKey, opener, cameraOrigin } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		fileKey: string
		opener?: string
		cameraOrigin?: ScanOrigin
	}>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return (
		<Page
			visitId={id}
			acquisitionId={acquisitionId}
			fileKey={fileKey}
			opening={reviewOpeningOf(opener, cameraOrigin)}
			patient={visit.patient}
		/>
	)
}

function Page({ visitId, acquisitionId, fileKey, opening, patient }: Props) {
	const router = useRouter()
	const { photos: pages } = useCaptureSession(acquisitionId)
	const flow = useScanFlow(visitId, acquisitionId)
	const edits = usePhotoEdits(acquisitionId)
	const pageEdits = usePageCrop(acquisitionId)
	const selected = pages.find((page) => page.fileKey === fileKey) ?? pages[0]
	if (selected === undefined) {
		return null
	}

	// CAP-018-R11
	const remove = async (page: BufferedFile) => {
		const isLast = pages.length === 1
		if ((await edits.remove(page)) && isLast) {
			flow.back()
		}
	}

	// CAP-015-R36, CAP-019-S12, CAP-009-S05, Q-076
	const retake = async (page: BufferedFile) => {
		const retakeOfPage = retakeOfFile(page)
		if (retakeOfPage === undefined) {
			return
		}
		await retakeInPlace(
			retakeOfPage,
			page.fileKey,
			() => edits.remove(page),
			(replacedKey) => flow.retakeFromReview(replacedKey, opening),
		)
	}

	return (
		<PageReviewScreen
			pages={pages}
			selected={selected}
			patient={patient}
			isBusy={edits.isBusy || pageEdits.isBusy}
			failure={edits.failure ?? pageEdits.failure}
			onSelect={(nextKey) => router.setParams({ fileKey: nextKey })}
			onRemove={(page) => void remove(page)}
			onRotate={(page) => void pageEdits.rotate(page)}
			onCrop={(page) => flow.crop(page.fileKey)}
			onRetake={(page) => void retake(page)}
			onDismissFailure={() => {
				edits.dismissFailure()
				pageEdits.dismissFailure()
			}}
			onBack={flow.back}
			onClose={flow.back}
		/>
	)
}
