import { ACQUISITION_KIND } from "@ansora/contracts"
import { Redirect, useLocalSearchParams } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { captureSessionOf, useCaptureSession } from "../../../../../features/capture/capture-session"
import { CaptureScreen } from "../../../../../features/capture/components/CaptureScreen"
import { RecordCancellationDialogs } from "../../../../../features/capture/components/RecordCancellationDialogs"
import { useCameraCapture } from "../../../../../features/capture/hooks/use-camera-capture"
import {
	CAPTURE_ORIGIN,
	type CaptureOrigin,
	useCaptureFlow,
} from "../../../../../features/capture/hooks/use-capture-flow"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import { useRecordCancellation } from "../../../../../features/capture/hooks/use-record-cancellation"
import type { PhotoOwner } from "../../../../../features/capture/photo-buffer"
import { isRecordEmpty } from "../../../../../features/capture/record-cancellation"
import { useTorch } from "../../../../../features/capture/torch"
import { REVIEW_OPENER } from "../../../../../features/summary/review-opening"
import { recordFileCountOf } from "../../../../../features/summary/shown-file"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	owner: PhotoOwner
	isFromSummary: boolean
	replacedKey: string | undefined
	patient: Patient
}

// CAP-015-R31, CAP-015-R10, CAP-015-R36
export default function CaptureRoute() {
	const { id, acquisitionId, origin, replaces } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		origin?: CaptureOrigin
		replaces?: string
	}>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return (
		<Capture
			visitId={id}
			owner={owner}
			isFromSummary={origin === CAPTURE_ORIGIN.SUMMARY}
			replacedKey={replaces}
			patient={visit.patient}
		/>
	)
}

// CAP-015-R13, CAP-015-R35, CAP-015-R36, CAP-015-R37
function Capture({ visitId, owner, isFromSummary, replacedKey, patient }: Props) {
	const { photos, shots, previews, draft } = useCaptureSession(owner.acquisitionId)
	const camera = useCameraCapture(
		owner,
		recordFileCountOf(photos, draft?.files ?? [], replacedKey) + shots.length,
		replacedKey,
	)
	const torch = useTorch(visitId)
	const flow = useCaptureFlow(visitId, owner.acquisitionId)
	const closing = useRecordCancellation(
		owner.acquisitionId,
		isRecordEmpty(photos, draft?.files ?? [], shots),
		flow.close,
	)

	// CAP-015-R31, CAP-015-R33, CAP-015-R21
	const proceed = async () => {
		if (!(await camera.isReadyToContinue())) {
			return
		}
		if (isFromSummary) {
			flow.back()
			return
		}
		if (captureSessionOf(owner.acquisitionId).photos.length > 0) {
			flow.location()
		}
	}

	return (
		<>
			<CaptureScreen
				patient={patient}
				photos={photos}
				shots={shots}
				previews={previews}
				camera={camera}
				isTorchOn={torch.isOn}
				onTorch={torch.toggle}
				onClose={closing.requestClose}
				onContinue={() => void proceed()}
				onReview={(fileKey) =>
					flow.review(fileKey, {
						opener: REVIEW_OPENER.CAMERA,
						cameraOrigin: isFromSummary ? CAPTURE_ORIGIN.SUMMARY : undefined,
					})
				}
			/>
			<RecordCancellationDialogs kind={ACQUISITION_KIND.PHOTO} closing={closing} />
		</>
	)
}
