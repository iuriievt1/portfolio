import { ACQUISITION_KIND } from "@ansora/contracts"
import { Redirect, useLocalSearchParams } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { RecordCancellationDialogs } from "../../../../../features/capture/components/RecordCancellationDialogs"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import { useRecordCancellation } from "../../../../../features/capture/hooks/use-record-cancellation"
import type { PhotoOwner } from "../../../../../features/capture/photo-buffer"
import { isRecordEmpty } from "../../../../../features/capture/record-cancellation"
import { useTorch } from "../../../../../features/capture/torch"
import { ScannerScreen } from "../../../../../features/scan/components/ScannerScreen"
import { useKnownDraft } from "../../../../../features/scan/hooks/use-known-draft"
import { usePageScanner } from "../../../../../features/scan/hooks/use-page-scanner"
import { SCAN_ORIGIN, type ScanOrigin, useScanFlow } from "../../../../../features/scan/hooks/use-scan-flow"
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

// CAP-018-R02, CAP-018-R14, CAP-015-R36, Figma 06 A.1, A.2, E.1, F.1
export default function ScanRoute() {
	const { id, acquisitionId, origin, replaces } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		origin?: ScanOrigin
		replaces?: string
	}>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return (
		<Scan
			visitId={id}
			owner={owner}
			isFromSummary={origin === SCAN_ORIGIN.SUMMARY}
			replacedKey={replaces}
			patient={visit.patient}
		/>
	)
}

// CAP-018-R12, CAP-015-R35, CAP-015-R36, CAP-015-R37
function Scan({ visitId, owner, isFromSummary, replacedKey, patient }: Props) {
	const { photos: pages, shots, previews, draft } = useCaptureSession(owner.acquisitionId)
	const scanner = usePageScanner(
		owner,
		recordFileCountOf(pages, draft?.files ?? [], replacedKey) + shots.length,
		replacedKey,
	)
	const torch = useTorch(visitId)
	const flow = useScanFlow(visitId, owner.acquisitionId)
	const closing = useRecordCancellation(
		owner.acquisitionId,
		isRecordEmpty(pages, draft?.files ?? [], shots),
		flow.close,
	)
	useKnownDraft(owner.acquisitionId)

	// CAP-018-R15
	const proceed = async () => {
		if (!(await scanner.isReadyToContinue())) {
			return
		}
		if (isFromSummary) {
			flow.back()
			return
		}
		if (draft?.document_title !== undefined) {
			flow.summary()
			return
		}
		flow.title()
	}

	return (
		<>
			<ScannerScreen
				patient={patient}
				pages={pages}
				shots={shots}
				previews={previews}
				scanner={scanner}
				isTorchOn={torch.isOn}
				onTorch={torch.toggle}
				onClose={closing.requestClose}
				onContinue={() => void proceed()}
				onOpenPage={(fileKey) =>
					flow.page(fileKey, {
						opener: REVIEW_OPENER.CAMERA,
						cameraOrigin: isFromSummary ? SCAN_ORIGIN.SUMMARY : undefined,
					})
				}
				onCropPage={flow.crop}
			/>
			<RecordCancellationDialogs kind={ACQUISITION_KIND.SCAN} closing={closing} />
		</>
	)
}
