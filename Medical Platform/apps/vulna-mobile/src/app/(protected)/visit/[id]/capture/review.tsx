import type { BufferedFile } from "@ansora/core-mobile"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { ReviewScreen } from "../../../../../features/capture/components/ReviewScreen"
import { type CaptureOrigin, useCaptureFlow } from "../../../../../features/capture/hooks/use-capture-flow"
import { usePhotoEdits } from "../../../../../features/capture/hooks/use-photo-edits"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import { retakeInPlace, retakeOfFile } from "../../../../../features/summary/retake"
import { type ReviewOpening, reviewOpeningOf } from "../../../../../features/summary/review-opening"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	fileKey: string
	opening: ReviewOpening<CaptureOrigin>
	patient: Patient
}

// CAP-015-R32, CAP-015-R34, CAP-015-R18, CAP-015-R36
export default function ReviewRoute() {
	const { id, acquisitionId, fileKey, opener, cameraOrigin } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		fileKey: string
		opener?: string
		cameraOrigin?: CaptureOrigin
	}>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return (
		<Review
			visitId={id}
			acquisitionId={acquisitionId}
			fileKey={fileKey}
			opening={reviewOpeningOf(opener, cameraOrigin)}
			patient={visit.patient}
		/>
	)
}

function Review({ visitId, acquisitionId, fileKey, opening, patient }: Props) {
	const router = useRouter()
	const { photos } = useCaptureSession(acquisitionId)
	const flow = useCaptureFlow(visitId, acquisitionId)
	const edits = usePhotoEdits(acquisitionId)
	const selected = photos.find((photo) => photo.fileKey === fileKey) ?? photos[0]
	if (selected === undefined) {
		return null
	}

	// CAP-015-S12
	const remove = async (photo: BufferedFile) => {
		const isLast = photos.length === 1
		if ((await edits.remove(photo)) && isLast) {
			flow.back()
		}
	}

	// CAP-015-R36, CAP-019-S12, CAP-009-S05, Q-076
	const retake = async (photo: BufferedFile) => {
		const retakeOfPhoto = retakeOfFile(photo)
		if (retakeOfPhoto === undefined) {
			return
		}
		await retakeInPlace(
			retakeOfPhoto,
			photo.fileKey,
			() => edits.remove(photo),
			(replacedKey) => flow.retakeFromReview(replacedKey, opening),
		)
	}

	return (
		<ReviewScreen
			photos={photos}
			selected={selected}
			patient={patient}
			isBusy={edits.isBusy}
			failure={edits.failure}
			onSelect={(nextKey) => router.setParams({ fileKey: nextKey })}
			onDelete={(photo) => void remove(photo)}
			onRotate={(photo) => void edits.rotate(photo)}
			onCrop={(photo) => flow.crop(photo.fileKey)}
			onRetake={(photo) => void retake(photo)}
			onDismissFailure={edits.dismissFailure}
			onBack={flow.back}
			onClose={flow.back}
		/>
	)
}
